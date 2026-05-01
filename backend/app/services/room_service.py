"""
Community room management service.

Handles room creation, membership, messaging, and moderation.
Publishes messages to Redis for real-time delivery.
"""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import hash_password, verify_password
from app.models.room import CommunityRoom, RoomMember, RoomMessage
from app.models.user import User
from app.ws.manager import ws_manager


async def create_room(
    db: AsyncSession,
    creator_id: uuid.UUID,
    name: str,
    description: str | None = None,
    is_password_protected: bool = False,
    password: str | None = None,
) -> CommunityRoom:
    """Create a new community room."""
    if is_password_protected and not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password required for protected rooms",
        )
    
    room = CommunityRoom(
        creator_id=creator_id,
        name=name,
        description=description,
        is_password_protected=is_password_protected,
        password_hash=hash_password(password) if password else None,
        member_count=1,
    )
    db.add(room)
    await db.flush()
    
    # Add creator as first member
    member = RoomMember(
        room_id=room.id,
        member_id=creator_id,
        joined_at=datetime.now(timezone.utc),
    )
    db.add(member)
    
    await db.commit()
    await db.refresh(room)
    return room


async def get_room(db: AsyncSession, room_id: uuid.UUID) -> dict:
    """Get room details with member count and recent messages."""
    result = await db.execute(
        select(CommunityRoom)
        .where(CommunityRoom.id == room_id)
        .options(selectinload(CommunityRoom.creator))
    )
    room = result.scalar_one_or_none()
    
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Get recent messages
    msg_result = await db.execute(
        select(RoomMessage)
        .where(RoomMessage.room_id == room_id)
        .order_by(RoomMessage.created_at.desc())
        .limit(5)
        .options(selectinload(RoomMessage.sender))
    )
    messages = msg_result.scalars().all()
    
    return {
        "id": str(room.id),
        "name": room.name,
        "description": room.description,
        "creator": {
            "id": str(room.creator.id),
            "username": room.creator.username,
        },
        "member_count": room.member_count,
        "is_active": room.is_active,
        "is_password_protected": room.is_password_protected,
        "created_at": room.created_at.isoformat(),
        "recent_messages": [
            {
                "id": str(m.id),
                "sender": {
                    "id": str(m.sender.id),
                    "username": m.sender.username,
                } if m.sender else None,
                "content": m.content,
                "created_at": m.created_at.isoformat(),
            }
            for m in reversed(messages)
        ],
    }


async def list_rooms(
    db: AsyncSession, skip: int = 0, limit: int = 20, is_active: bool = True
) -> list[dict]:
    """List rooms (pagination, active only by default)."""
    query = select(CommunityRoom)
    
    if is_active:
        query = query.where(CommunityRoom.is_active == True)
    
    query = (
        query.order_by(CommunityRoom.created_at.desc())
        .offset(skip)
        .limit(limit)
        .options(selectinload(CommunityRoom.creator))
    )
    
    result = await db.execute(query)
    rooms = result.scalars().all()
    
    return [
        {
            "id": str(r.id),
            "name": r.name,
            "description": r.description,
            "creator": {
                "id": str(r.creator.id),
                "username": r.creator.username,
            },
            "member_count": r.member_count,
            "is_active": r.is_active,
            "created_at": r.created_at.isoformat(),
        }
        for r in rooms
    ]


async def join_room(
    db: AsyncSession,
    user_id: uuid.UUID,
    room_id: uuid.UUID,
    password: str | None = None,
) -> CommunityRoom:
    """Join a room (verify password if protected)."""
    room_result = await db.execute(select(CommunityRoom).where(CommunityRoom.id == room_id))
    room = room_result.scalar_one_or_none()
    
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if not room.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Room is inactive",
        )
    
    # Check password if protected
    if room.is_password_protected:
        if not password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Password required",
            )
        if not verify_password(password, room.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password",
            )
    
    # Check if already member
    existing = await db.execute(
        select(RoomMember).where(
            and_(RoomMember.room_id == room_id, RoomMember.member_id == user_id)
        )
    )
    if existing.scalar_one_or_none():
        return room
    
    # Add member
    member = RoomMember(
        room_id=room_id,
        member_id=user_id,
        joined_at=datetime.now(timezone.utc),
    )
    db.add(member)
    room.member_count += 1
    
    await db.commit()
    await db.refresh(room)
    return room


async def leave_room(db: AsyncSession, user_id: uuid.UUID, room_id: uuid.UUID) -> None:
    """Leave a room."""
    member_result = await db.execute(
        select(RoomMember).where(
            and_(RoomMember.room_id == room_id, RoomMember.member_id == user_id)
        )
    )
    member = member_result.scalar_one_or_none()
    
    if not member:
        raise HTTPException(status_code=404, detail="Not a member of this room")
    
    room_result = await db.execute(select(CommunityRoom).where(CommunityRoom.id == room_id))
    room = room_result.scalar_one_or_none()
    
    await db.delete(member)
    if room:
        room.member_count = max(0, room.member_count - 1)
    
    await db.commit()


async def send_message(
    db: AsyncSession, room_id: uuid.UUID, sender_id: uuid.UUID, content: str
) -> RoomMessage:
    """Send a message to a room and publish to Redis."""
    room_result = await db.execute(select(CommunityRoom).where(CommunityRoom.id == room_id))
    room = room_result.scalar_one_or_none()
    
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check membership
    member_result = await db.execute(
        select(RoomMember).where(
            and_(RoomMember.room_id == room_id, RoomMember.member_id == sender_id)
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this room",
        )
    
    message = RoomMessage(
        room_id=room_id,
        sender_id=sender_id,
        content=content,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    
    # Publish to Redis for real-time delivery
    channel = f"cc:room:{room_id}"
    payload = {
        "type": "message",
        "message": {
            "id": str(message.id),
            "sender_id": str(sender_id),
            "content": content,
            "created_at": message.created_at.isoformat(),
        },
    }
    await ws_manager.publish_to_channel(channel, payload)
    
    return message


async def get_messages(
    db: AsyncSession, room_id: uuid.UUID, skip: int = 0, limit: int = 50
) -> list[dict]:
    """Get paginated messages for a room."""
    result = await db.execute(
        select(RoomMessage)
        .where(RoomMessage.room_id == room_id)
        .order_by(RoomMessage.created_at.desc())
        .offset(skip)
        .limit(limit)
        .options(selectinload(RoomMessage.sender))
    )
    messages = result.scalars().all()
    
    return [
        {
            "id": str(m.id),
            "sender": {
                "id": str(m.sender.id),
                "username": m.sender.username,
            } if m.sender else None,
            "content": m.content,
            "is_pinned": m.is_pinned,
            "created_at": m.created_at.isoformat(),
        }
        for m in reversed(messages)
    ]


async def pin_message(
    db: AsyncSession, room_id: uuid.UUID, message_id: uuid.UUID, user_id: uuid.UUID
) -> RoomMessage:
    """Pin a message (verify user is creator/admin)."""
    room_result = await db.execute(select(CommunityRoom).where(CommunityRoom.id == room_id))
    room = room_result.scalar_one_or_none()
    
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room.creator_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only room creator can pin messages",
        )
    
    msg_result = await db.execute(select(RoomMessage).where(RoomMessage.id == message_id))
    message = msg_result.scalar_one_or_none()
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    message.is_pinned = True
    await db.commit()
    await db.refresh(message)
    return message


async def delete_message(
    db: AsyncSession, room_id: uuid.UUID, message_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    """Delete a message (verify user is sender or room creator)."""
    msg_result = await db.execute(select(RoomMessage).where(RoomMessage.id == message_id))
    message = msg_result.scalar_one_or_none()
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    room_result = await db.execute(select(CommunityRoom).where(CommunityRoom.id == room_id))
    room = room_result.scalar_one_or_none()
    
    # Verify user is sender or room creator
    if message.sender_id != user_id and room.creator_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete message",
        )
    
    await db.delete(message)
    await db.commit()


async def delete_room(db: AsyncSession, room_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Delete a room (verify user is creator)."""
    room_result = await db.execute(select(CommunityRoom).where(CommunityRoom.id == room_id))
    room = room_result.scalar_one_or_none()
    
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room.creator_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only room creator can delete the room",
        )
    
    await db.delete(room)
    await db.commit()


async def get_room_members(
    db: AsyncSession, room_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[dict]:
    """Get member list for a room."""
    result = await db.execute(
        select(RoomMember)
        .where(RoomMember.room_id == room_id)
        .order_by(RoomMember.joined_at)
        .offset(skip)
        .limit(limit)
        .options(selectinload(RoomMember.member))
    )
    members = result.scalars().all()
    
    return [
        {
            "id": str(m.member.id),
            "username": m.member.username,
            "avatar_url": m.member.avatar_url,
            "joined_at": m.joined_at.isoformat(),
        }
        for m in members
    ]
