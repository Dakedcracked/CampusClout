"""
Chat service — thread management, message sending, token-burn cost.

Cost formula (tokens burned to send a DM to a higher-cap user):

    cost = min( floor((target_cap - sender_cap) / 100), 50 )

Examples:
  • target_cap ≤ sender_cap  → 0 tokens (free)
  • gap = 1 000             → 10 tokens
  • gap = 5 000             → 50 tokens (capped)
"""

import math
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.chat import ChatMessage, ChatThread
from app.models.economy import CloutBalance
from app.models.user import User
from app.schemas.chat import DmCostResponse, MessageResponse, ThreadResponse, ThreadParticipant
from app.ws.chat_manager import chat_manager


def _canonical_pair(a: uuid.UUID, b: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    return (a, b) if str(a) < str(b) else (b, a)


def _dm_cost(sender_cap: float, target_cap: float) -> int:
    if target_cap <= sender_cap:
        return 0
    return min(int((target_cap - sender_cap) / 100), 50)


async def _get_user_with_balance(db: AsyncSession, user_id: uuid.UUID) -> User:
    result = await db.execute(
        select(User).where(User.id == user_id).options(selectinload(User.clout_balance))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def get_dm_cost(
    db: AsyncSession, sender_id: uuid.UUID, target_username: str
) -> DmCostResponse:
    sender = await _get_user_with_balance(db, sender_id)
    target_result = await db.execute(
        select(User).where(User.username == target_username.lower())
        .options(selectinload(User.clout_balance))
    )
    target = target_result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    sender_cap = sender.clout_balance.market_cap if sender.clout_balance else 0.0
    target_cap = target.clout_balance.market_cap if target.clout_balance else 0.0
    cost = _dm_cost(sender_cap, target_cap)
    wallet = sender.clout_balance.wallet_balance if sender.clout_balance else 0

    return DmCostResponse(
        target_username=target.username,
        target_market_cap=target_cap,
        sender_market_cap=sender_cap,
        token_cost=cost,
        can_afford=wallet >= cost,
        wallet_balance=wallet,
    )


async def get_or_create_thread(
    db: AsyncSession, user_a_id: uuid.UUID, user_b_id: uuid.UUID
) -> ChatThread:
    if user_a_id == user_b_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot start a DM with yourself",
        )
    a, b = _canonical_pair(user_a_id, user_b_id)

    result = await db.execute(
        select(ChatThread)
        .where(ChatThread.user_a_id == a, ChatThread.user_b_id == b)
        .options(
            selectinload(ChatThread.user_a).selectinload(User.clout_balance),
            selectinload(ChatThread.user_b).selectinload(User.clout_balance),
        )
    )
    thread = result.scalar_one_or_none()
    if thread:
        return thread

    thread = ChatThread(user_a_id=a, user_b_id=b)
    db.add(thread)
    await db.commit()
    await db.refresh(thread)

    # Reload with relationships
    result = await db.execute(
        select(ChatThread)
        .where(ChatThread.id == thread.id)
        .options(
            selectinload(ChatThread.user_a).selectinload(User.clout_balance),
            selectinload(ChatThread.user_b).selectinload(User.clout_balance),
        )
    )
    return result.scalar_one()


async def list_threads(db: AsyncSession, user_id: uuid.UUID) -> list[ThreadResponse]:
    result = await db.execute(
        select(ChatThread)
        .where((ChatThread.user_a_id == user_id) | (ChatThread.user_b_id == user_id))
        .options(
            selectinload(ChatThread.user_a).selectinload(User.clout_balance),
            selectinload(ChatThread.user_b).selectinload(User.clout_balance),
            selectinload(ChatThread.messages),
        )
        .order_by(ChatThread.last_message_at.desc().nullslast())
    )
    threads = result.scalars().all()

    responses: list[ThreadResponse] = []
    for t in threads:
        other = t.user_b if t.user_a_id == user_id else t.user_a
        other_balance = other.clout_balance.market_cap if other and other.clout_balance else 0.0
        last_msg = t.messages[-1] if t.messages else None
        responses.append(
            ThreadResponse(
                id=t.id,
                other_user=ThreadParticipant(
                    user_id=other.id,
                    username=other.username,
                    display_name=other.display_name,
                    market_cap=other_balance,
                ),
                last_message_at=t.last_message_at,
                last_message_preview=(last_msg.content[:60] if last_msg else None),
                created_at=t.created_at,
            )
        )
    return responses


async def get_thread_messages(
    db: AsyncSession,
    thread_id: uuid.UUID,
    user_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
) -> list[MessageResponse]:
    # Verify participant
    result = await db.execute(select(ChatThread).where(ChatThread.id == thread_id))
    thread = result.scalar_one_or_none()
    if not thread or user_id not in (thread.user_a_id, thread.user_b_id):
        raise HTTPException(status_code=403, detail="Not a participant in this thread")

    msgs_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.thread_id == thread_id)
        .options(selectinload(ChatMessage.sender))
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
        .offset(offset)
    )
    return [_to_msg_response(m) for m in msgs_result.scalars().all()]


async def send_message(
    db: AsyncSession,
    thread_id: uuid.UUID,
    sender_id: uuid.UUID,
    content: str,
) -> MessageResponse:
    # Verify participant and load thread
    result = await db.execute(
        select(ChatThread)
        .where(ChatThread.id == thread_id)
        .options(
            selectinload(ChatThread.user_a).selectinload(User.clout_balance),
            selectinload(ChatThread.user_b).selectinload(User.clout_balance),
        )
    )
    thread = result.scalar_one_or_none()
    if not thread or sender_id not in (thread.user_a_id, thread.user_b_id):
        raise HTTPException(status_code=403, detail="Not a participant in this thread")

    recipient = thread.user_b if thread.user_a_id == sender_id else thread.user_a
    sender_user = thread.user_a if thread.user_a_id == sender_id else thread.user_b

    sender_cap = sender_user.clout_balance.market_cap if sender_user.clout_balance else 0.0
    recipient_cap = recipient.clout_balance.market_cap if recipient.clout_balance else 0.0
    cost = _dm_cost(sender_cap, recipient_cap)

    # Deduct tokens if there's a cost
    if cost > 0:
        sender_balance = sender_user.clout_balance
        if not sender_balance or sender_balance.wallet_balance < cost:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Insufficient tokens. This DM costs {cost} tokens; you have "
                       f"{sender_balance.wallet_balance if sender_balance else 0}.",
            )
        sender_balance.wallet_balance -= cost

    msg = ChatMessage(
        thread_id=thread_id,
        sender_id=sender_id,
        content=content,
        token_cost=cost,
    )
    db.add(msg)
    thread.last_message_at = datetime.now(timezone.utc)
    thread.last_icebreaker_at = None  # reset so idle monitor can fire again later

    await db.commit()
    await db.refresh(msg)

    # Reload sender relationship
    await db.refresh(msg, ["sender"])

    msg_response = _to_msg_response(msg)

    # Broadcast to all connected WS clients in this thread
    await chat_manager.publish(str(thread_id), {
        "type": "message",
        "message": {
            "id": str(msg.id),
            "thread_id": str(msg.thread_id),
            "sender_id": str(msg.sender_id),
            "sender_username": msg.sender.username if msg.sender else None,
            "content": msg.content,
            "token_cost": msg.token_cost,
            "is_ai_icebreaker": False,
            "created_at": msg.created_at.isoformat(),
        },
    })

    return msg_response


async def inject_ai_message(
    db: AsyncSession,
    thread: ChatThread,
    content: str,
) -> ChatMessage:
    msg = ChatMessage(
        thread_id=thread.id,
        sender_id=None,  # AI has no user identity
        content=content,
        token_cost=0,
        is_ai_icebreaker=True,
    )
    db.add(msg)
    thread.last_icebreaker_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(msg)

    await chat_manager.publish(str(thread.id), {
        "type": "icebreaker",
        "message": {
            "id": str(msg.id),
            "thread_id": str(msg.thread_id),
            "sender_id": None,
            "sender_username": "CampusBot",
            "content": msg.content,
            "token_cost": 0,
            "is_ai_icebreaker": True,
            "created_at": msg.created_at.isoformat(),
        },
    })
    return msg


def _to_msg_response(m: ChatMessage) -> MessageResponse:
    return MessageResponse(
        id=m.id,
        thread_id=m.thread_id,
        sender_id=m.sender_id,
        sender_username=m.sender.username if m.sender else ("CampusBot" if m.is_ai_icebreaker else None),
        content=m.content,
        token_cost=m.token_cost,
        is_ai_icebreaker=m.is_ai_icebreaker,
        created_at=m.created_at,
    )
