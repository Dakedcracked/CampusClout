import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.user import User
from app.schemas.chat import (
    DmCostResponse,
    MessageResponse,
    SendMessageRequest,
    ThreadParticipant,
    ThreadResponse,
)
from app.services.chat_service import (
    get_dm_cost,
    get_or_create_thread,
    get_thread_messages,
    list_threads,
    send_message,
)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/threads", response_model=list[ThreadResponse])
async def my_threads(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> list[ThreadResponse]:
    user_id = uuid.UUID(get_current_user_id(request))
    return await list_threads(db, user_id)


@router.post("/threads/{username}", response_model=ThreadResponse, status_code=status.HTTP_200_OK)
async def open_thread(
    username: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> ThreadResponse:
    sender_id = uuid.UUID(get_current_user_id(request))

    target_result = await db.execute(
        select(User).where(User.username == username.lower())
        .options(selectinload(User.clout_balance))
    )
    target = target_result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    thread = await get_or_create_thread(db, sender_id, target.id)

    other = target
    return ThreadResponse(
        id=thread.id,
        other_user=ThreadParticipant(
            user_id=other.id,
            username=other.username,
            display_name=other.display_name,
            market_cap=other.clout_balance.market_cap if other.clout_balance else 0.0,
        ),
        last_message_at=thread.last_message_at,
        last_message_preview=None,
        created_at=thread.created_at,
    )


@router.get("/threads/{thread_id}/messages", response_model=list[MessageResponse])
async def thread_messages(
    thread_id: uuid.UUID,
    request: Request,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
) -> list[MessageResponse]:
    user_id = uuid.UUID(get_current_user_id(request))
    return await get_thread_messages(db, thread_id, user_id, limit=limit, offset=offset)


@router.post("/threads/{thread_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def post_message(
    thread_id: uuid.UUID,
    data: SendMessageRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    sender_id = uuid.UUID(get_current_user_id(request))
    return await send_message(db, thread_id, sender_id, data.content)


@router.get("/cost/{username}", response_model=DmCostResponse)
async def dm_cost(
    username: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> DmCostResponse:
    sender_id = uuid.UUID(get_current_user_id(request))
    return await get_dm_cost(db, sender_id, username)
