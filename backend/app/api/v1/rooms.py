import json
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.redis_client import get_redis
from app.core.security import get_current_user_id, hash_password, verify_password
from app.models.room import CommunityRoom, RoomMember, RoomMessage
from app.models.user import User
from app.schemas.rooms import (
    RoomCreateRequest,
    RoomDetailResponse,
    RoomJoinRequest,
    RoomLeaveResponse,
    RoomListResponse,
    RoomMemberInfo,
    RoomMembersResponse,
    RoomMessageCreateRequest,
    RoomMessagePinResponse,
    RoomMessageResponse,
    RoomMessagesResponse,
)
from app.ws.room_manager import room_manager

log = logging.getLogger(__name__)

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.get("", response_model=RoomListResponse)
async def list_rooms(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    is_public: str | None = Query(None, description="Filter by public/private ('true', 'false', or '1', '0')"),
    db: AsyncSession = Depends(get_db),
) -> RoomListResponse:
    """List active rooms (paginated), optionally filtered by public/private status."""
    query = select(CommunityRoom).where(CommunityRoom.is_active == True)
    
    # Filter by public/private if specified
    if is_public is not None:
        # Convert string to boolean
        is_public_bool = is_public.lower() in ('true', '1', 'yes')
        query = query.where(CommunityRoom.is_public == is_public_bool)
    
    # Count total with filters applied
    count_query = select(func.count(CommunityRoom.id)).where(CommunityRoom.is_active == True)
    if is_public is not None:
        is_public_bool = is_public.lower() in ('true', '1', 'yes')
        count_query = count_query.where(CommunityRoom.is_public == is_public_bool)
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Fetch rooms
    rooms_result = await db.execute(
        query
        .options(selectinload(CommunityRoom.creator))
        .order_by(CommunityRoom.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    rooms = rooms_result.scalars().all()

    return RoomListResponse(
        rooms=[
            RoomDetailResponse(
                id=r.id,
                name=r.name,
                description=r.description,
                creator_id=r.creator_id,
                creator_username=r.creator.username,
                member_count=r.member_count,
                is_password_protected=r.is_password_protected,
                is_public=r.is_public,
                is_active=r.is_active,
                created_at=r.created_at,
            )
            for r in rooms
        ],
        total=total,
    )


@router.post("", response_model=RoomDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_room(
    data: RoomCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> RoomDetailResponse:
    """Create a new room."""
    creator_id = uuid.UUID(get_current_user_id(request))

    # Get creator info
    creator_result = await db.execute(select(User).where(User.id == creator_id))
    creator = creator_result.scalar_one()

    # Hash password if provided
    password_hash = None
    if data.is_password_protected and data.password:
        password_hash = hash_password(data.password)

    room = CommunityRoom(
        id=uuid.uuid4(),
        creator_id=creator_id,
        name=data.name,
        description=data.description,
        is_password_protected=data.is_password_protected,
        password_hash=password_hash,
        is_public=data.is_public,
        member_count=1,
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(room)
    await db.flush()

    # Add creator as member
    member = RoomMember(
        id=uuid.uuid4(),
        room_id=room.id,
        member_id=creator_id,
        joined_at=datetime.utcnow(),
    )
    db.add(member)
    await db.commit()

    return RoomDetailResponse(
        id=room.id,
        name=room.name,
        description=room.description,
        creator_id=room.creator_id,
        creator_username=creator.username,
        member_count=room.member_count,
        is_password_protected=room.is_password_protected,
        is_public=room.is_public,
        is_active=room.is_active,
        created_at=room.created_at,
    )


@router.get("/my-memberships", response_model=list[RoomDetailResponse])
async def my_memberships(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> list[RoomDetailResponse]:
    """Get all rooms the current user is a member of."""
    user_id = uuid.UUID(get_current_user_id(request))

    # Get all room IDs the user is a member of
    members_result = await db.execute(
        select(RoomMember.room_id).where(RoomMember.member_id == user_id)
    )
    room_ids = [r[0] for r in members_result.all()]

    if not room_ids:
        return []

    # Get room details
    rooms_result = await db.execute(
        select(CommunityRoom)
        .where(CommunityRoom.id.in_(room_ids))
        .options(selectinload(CommunityRoom.creator))
        .order_by(CommunityRoom.created_at.desc())
    )
    rooms = rooms_result.scalars().all()

    return [
        RoomDetailResponse(
            id=r.id,
            name=r.name,
            description=r.description,
            creator_id=r.creator_id,
            creator_username=r.creator.username,
            member_count=r.member_count,
            is_password_protected=r.is_password_protected,
            is_public=r.is_public,
            is_active=r.is_active,
            created_at=r.created_at,
        )
        for r in rooms
    ]


# ------------------------------------------------------------------
# WebSocket endpoint for real-time room chat
# ------------------------------------------------------------------

async def _resolve_room_ticket(websocket: WebSocket, ticket: str) -> str | None:
    """Returns user_id string or None if the ticket is invalid/expired."""
    redis = getattr(websocket.app.state, "redis", None)

    # Dev fallback: ticket encoded as "dev:{user_id}"
    if ticket.startswith("dev:"):
        return ticket[4:]

    if not redis:
        return None

    user_id = await redis.getdel(f"cc:ws_ticket:{ticket}")
    return user_id  # None if expired or not found


@router.websocket("/ws/{room_id}")
async def room_ws(
    websocket: WebSocket,
    room_id: uuid.UUID,
    ticket: str = Query(..., description="Single-use WS auth ticket from POST /auth/ws-ticket"),
) -> None:
    """WebSocket endpoint for real-time room chat."""
    user_id = await _resolve_room_ticket(websocket, ticket)
    if not user_id:
        await websocket.close(code=4001, reason="Invalid or expired ticket")
        return

    room_id_str = str(room_id)

    # Verify room exists and user is a member
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        room_result = await db.execute(
            select(CommunityRoom).where(CommunityRoom.id == room_id)
        )
        room = room_result.scalar_one_or_none()

        if not room:
            await websocket.close(code=4004, reason="Room not found")
            return

        member_result = await db.execute(
            select(RoomMember).where(
                and_(
                    RoomMember.room_id == room_id,
                    RoomMember.member_id == uuid.UUID(user_id),
                )
            )
        )
        if not member_result.scalar_one_or_none():
            await websocket.close(code=4003, reason="Not a member of this room")
            return

        user_result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = user_result.scalar_one()

    # Connect to room manager
    await room_manager.connect(room_id_str, user, websocket)

    try:
        while True:
            data = await websocket.receive_text()
            if not data:
                continue

            try:
                message_data = json.loads(data)
            except json.JSONDecodeError:
                continue

            # Validate message structure
            if not isinstance(message_data, dict):
                continue
                
            # Allow typing events through
            if message_data.get("type") in ["typing_start", "typing_end"]:
                message_data["username"] = user.username
                await room_manager.publish(room_id_str, message_data)
                continue

            content = message_data.get("content", "").strip()
            image_url = message_data.get("image_url")
            image_type = message_data.get("image_type")
            
            if not content and not image_url:
                continue

            # Create message record in database
            async with AsyncSessionLocal() as db:
                room_message = RoomMessage(
                    id=uuid.uuid4(),
                    room_id=room_id,
                    sender_id=uuid.UUID(user_id),
                    content=content,
                    image_url=image_url,
                    image_type=image_type,
                    is_pinned=False,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(room_message)
                await db.commit()

                # Broadcast to all room members
                broadcast_message = {
                    "type": "message",
                    "message": {
                        "id": str(room_message.id),
                        "sender_id": str(room_message.sender_id),
                        "sender_username": user.username,
                        "content": content,
                        "image_url": image_url,
                        "image_type": image_type,
                        "created_at": room_message.created_at.isoformat(),
                        "is_pinned": False,
                    }
                }
                await room_manager.publish(room_id_str, broadcast_message)

    except WebSocketDisconnect:
        await room_manager.broadcast_member_left(room_id_str, user_id, user.username)
        room_manager.disconnect(room_id_str, user_id, websocket)
    except Exception as exc:
        log.error("Room WS error: %s", exc)
        await room_manager.broadcast_member_left(room_id_str, user_id, user.username)
        room_manager.disconnect(room_id_str, user_id, websocket)


@router.get("/{room_id}", response_model=RoomDetailResponse)
async def get_room(
    room_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> RoomDetailResponse:
    """Get room details."""
    room_result = await db.execute(
        select(CommunityRoom)
        .where(CommunityRoom.id == room_id)
        .options(selectinload(CommunityRoom.creator))
    )
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    return RoomDetailResponse(
        id=room.id,
        name=room.name,
        description=room.description,
        creator_id=room.creator_id,
        creator_username=room.creator.username,
        member_count=room.member_count,
        is_password_protected=room.is_password_protected,
        is_public=room.is_public,
        is_active=room.is_active,
        created_at=room.created_at,
    )


@router.post("/{room_id}/join", status_code=status.HTTP_200_OK)
async def join_room(
    room_id: uuid.UUID,
    data: RoomJoinRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Join a room."""
    user_id = uuid.UUID(get_current_user_id(request))

    room_result = await db.execute(select(CommunityRoom).where(CommunityRoom.id == room_id))
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # Check password if protected
    if room.is_password_protected:
        if not data.password:
            raise HTTPException(status_code=403, detail="Room is password protected")
        if not verify_password(data.password, room.password_hash or ""):
            raise HTTPException(status_code=403, detail="Invalid password")

    # Check if already member
    member_result = await db.execute(
        select(RoomMember).where(
            and_(RoomMember.room_id == room_id, RoomMember.member_id == user_id)
        )
    )
    if member_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already a member")

    # Add member
    member = RoomMember(
        id=uuid.uuid4(),
        room_id=room_id,
        member_id=user_id,
        joined_at=datetime.utcnow(),
    )
    db.add(member)
    room.member_count += 1
    await db.commit()

    return {"status": "joined_room"}


@router.post("/{room_id}/leave", response_model=RoomLeaveResponse)
async def leave_room(
    room_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> RoomLeaveResponse:
    """Leave a room."""
    user_id = uuid.UUID(get_current_user_id(request))

    member_result = await db.execute(
        select(RoomMember).where(
            and_(RoomMember.room_id == room_id, RoomMember.member_id == user_id)
        )
    )
    member = member_result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Not a member of this room")

    room_result = await db.execute(select(CommunityRoom).where(CommunityRoom.id == room_id))
    room = room_result.scalar_one()

    await db.delete(member)
    room.member_count = max(0, room.member_count - 1)
    await db.commit()

    return RoomLeaveResponse()


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_room(
    room_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Delete room (creator only)."""
    user_id = uuid.UUID(get_current_user_id(request))

    room_result = await db.execute(select(CommunityRoom).where(CommunityRoom.id == room_id))
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if room.creator_id != user_id:
        raise HTTPException(status_code=403, detail="Only creator can delete room")

    await db.delete(room)
    await db.commit()


@router.get("/{room_id}/members", response_model=RoomMembersResponse)
async def list_members(
    room_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> RoomMembersResponse:
    """List room members (paginated)."""
    # Verify room exists
    room_result = await db.execute(select(CommunityRoom).where(CommunityRoom.id == room_id))
    if not room_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Room not found")

    # Count total
    count_result = await db.execute(
        select(func.count(RoomMember.id)).where(RoomMember.room_id == room_id)
    )
    total = count_result.scalar() or 0

    # Fetch members
    members_result = await db.execute(
        select(RoomMember)
        .where(RoomMember.room_id == room_id)
        .options(selectinload(RoomMember.member))
        .order_by(RoomMember.joined_at.desc())
        .offset(skip)
        .limit(limit)
    )
    members = members_result.scalars().all()

    return RoomMembersResponse(
        members=[
            RoomMemberInfo(
                member_id=m.member_id,
                username=m.member.username,
                display_name=m.member.display_name,
                avatar_url=m.member.avatar_url,
                joined_at=m.joined_at,
            )
            for m in members
        ],
        total=total,
    )


@router.get("/{room_id}/messages", response_model=RoomMessagesResponse)
async def get_room_messages(
    room_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> RoomMessagesResponse:
    """Get room message history (paginated)."""
    # Verify room exists
    room_result = await db.execute(select(CommunityRoom).where(CommunityRoom.id == room_id))
    if not room_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Room not found")

    # Count total
    count_result = await db.execute(
        select(func.count(RoomMessage.id)).where(RoomMessage.room_id == room_id)
    )
    total = count_result.scalar() or 0

    # Fetch messages
    messages_result = await db.execute(
        select(RoomMessage)
        .where(RoomMessage.room_id == room_id)
        .options(selectinload(RoomMessage.sender))
        .order_by(RoomMessage.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    messages = messages_result.scalars().all()

    return RoomMessagesResponse(
        messages=[
            RoomMessageResponse(
                id=m.id,
                sender_id=m.sender_id,
                sender_username=m.sender.username if m.sender else None,
                sender_avatar=m.sender.avatar_url if m.sender else None,
                content=m.content,
                image_url=m.image_url,
                image_type=m.image_type,
                is_pinned=m.is_pinned,
                created_at=m.created_at,
            )
            for m in reversed(messages)
        ],
        total=total,
    )


@router.post("/{room_id}/messages", response_model=RoomMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_room_message(
    room_id: uuid.UUID,
    data: RoomMessageCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> RoomMessageResponse:
    """Send message to room."""
    sender_id = uuid.UUID(get_current_user_id(request))

    # Verify member
    member_result = await db.execute(
        select(RoomMember).where(
            and_(RoomMember.room_id == room_id, RoomMember.member_id == sender_id)
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this room")

    # Get sender info
    sender_result = await db.execute(select(User).where(User.id == sender_id))
    sender = sender_result.scalar_one()

    message = RoomMessage(
        id=uuid.uuid4(),
        room_id=room_id,
        sender_id=sender_id,
        content=data.content,
        image_url=data.image_url,
        image_type=data.image_type,
        is_pinned=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)

    return RoomMessageResponse(
        id=message.id,
        sender_id=message.sender_id,
        sender_username=sender.username,
        sender_avatar=sender.avatar_url,
        content=message.content,
        image_url=message.image_url,
        image_type=message.image_type,
        is_pinned=message.is_pinned,
        created_at=message.created_at,
    )


@router.post("/{room_id}/messages/{message_id}/pin", response_model=RoomMessagePinResponse)
async def pin_message(
    room_id: uuid.UUID,
    message_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> RoomMessagePinResponse:
    """Pin a message (creator/admin only)."""
    user_id = uuid.UUID(get_current_user_id(request))

    # Get room and check creator
    room_result = await db.execute(select(CommunityRoom).where(CommunityRoom.id == room_id))
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if room.creator_id != user_id:
        raise HTTPException(status_code=403, detail="Only creator can pin messages")

    # Get message and pin it
    msg_result = await db.execute(
        select(RoomMessage).where(
            and_(RoomMessage.id == message_id, RoomMessage.room_id == room_id)
        )
    )
    message = msg_result.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    message.is_pinned = True
    await db.commit()

    return RoomMessagePinResponse()


@router.delete("/{room_id}/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_room_message(
    room_id: uuid.UUID,
    message_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Delete message (sender/admin only)."""
    user_id = uuid.UUID(get_current_user_id(request))

    msg_result = await db.execute(
        select(RoomMessage).where(
            and_(RoomMessage.id == message_id, RoomMessage.room_id == room_id)
        )
    )
    message = msg_result.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Check authorization: sender or room creator
    room_result = await db.execute(select(CommunityRoom).where(CommunityRoom.id == room_id))
    room = room_result.scalar_one()

    if message.sender_id != user_id and room.creator_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this message")

    await db.delete(message)
    await db.commit()


