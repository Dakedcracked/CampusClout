"""Global campus chatroom service."""

import json
import uuid
from datetime import datetime, timezone

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.economy import CloutBalance, TokenTransaction, TransactionType
from app.models.global_chat import GlobalMessage
from app.models.user import User
from app.ws.global_manager import global_chat_manager

RUSH_HOUR_BASE_REWARD = 2
NORMAL_BASE_REWARD = 1
REDIS_CACHE_KEY = "cc:global_chat_recent"
REDIS_CACHE_TTL = 300  # 5 minutes


async def _cache_messages_in_redis(redis: Redis, messages: list) -> None:
    """Cache recent global messages in Redis for fast retrieval."""
    try:
        cache_data = json.dumps(messages)
        await redis.setex(REDIS_CACHE_KEY, REDIS_CACHE_TTL, cache_data)
    except Exception:
        # Ignore Redis errors; fallback to database
        pass


async def _get_cached_messages(redis: Redis) -> list | None:
    """Retrieve cached messages from Redis if available."""
    try:
        cached = await redis.get(REDIS_CACHE_KEY)
        if cached:
            return json.loads(cached)
    except Exception:
        # Ignore Redis errors
        pass
    return None


async def send_global_message(
    db: AsyncSession,
    sender_id: uuid.UUID,
    content: str,
    image_url: str | None = None,
    image_type: str | None = None,
    redis: Redis | None = None,
) -> dict:
    is_rush = await global_chat_manager.is_rush_hour()
    reward = RUSH_HOUR_BASE_REWARD if is_rush else NORMAL_BASE_REWARD

    user_result = await db.execute(
        select(User).where(User.id == sender_id)
    )
    user = user_result.scalar_one_or_none()
    if not user:
        return {}

    msg = GlobalMessage(
        sender_id=sender_id,
        content=content,
        image_url=image_url,
        image_type=image_type,
        token_reward=reward,
        is_rush_hour=is_rush,
    )
    db.add(msg)

    # Grant reward tokens to sender
    balance_result = await db.execute(
        select(CloutBalance).where(CloutBalance.user_id == sender_id)
    )
    balance = balance_result.scalar_one_or_none()
    if balance:
        balance.wallet_balance += reward
        tx = TokenTransaction(
            from_user_id=None,
            to_user_id=sender_id,
            amount=reward,
            transaction_type=TransactionType.MINT,
            note="Global chat reward" + (" (Rush Hour 2x)" if is_rush else ""),
        )
        db.add(tx)

    user.last_active_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(msg)

    payload = {
        "event": "global_message",
        "id": str(msg.id),
        "sender_id": str(sender_id),
        "username": user.username,
        "display_name": user.display_name,
        "content": content,
        "token_reward": reward,
        "is_rush_hour": is_rush,
        "created_at": msg.created_at.isoformat(),
    }
    await global_chat_manager.publish(payload)

    # Invalidate cache so next request fetches fresh data
    if redis:
        try:
            await redis.delete(REDIS_CACHE_KEY)
        except Exception:
            pass  # Ignore Redis errors

    return payload


async def get_recent_global_messages(db: AsyncSession, redis: Redis | None = None, limit: int = 50) -> list:
    """
    Get recent global messages with Redis caching.

    First checks Redis cache (5-min TTL) for performance.
    Falls back to database if cache miss.
    """
    # Try to get from cache first
    if redis:
        cached = await _get_cached_messages(redis)
        if cached:
            return cached[:limit]

    # Cache miss or no Redis: fetch from database
    result = await db.execute(
        select(GlobalMessage, User)
        .join(User, User.id == GlobalMessage.sender_id)
        .order_by(GlobalMessage.created_at.desc())
        .limit(limit)
    )
    rows = result.all()
    messages = [
        {
            "id": str(msg.id),
            "sender_id": str(msg.sender_id),
            "username": user.username,
            "display_name": user.display_name,
            "content": msg.content,
            "token_reward": msg.token_reward,
            "is_rush_hour": msg.is_rush_hour,
            "created_at": msg.created_at.isoformat(),
        }
        for msg, user in reversed(rows)
    ]

    # Cache for next 5 minutes
    if redis:
        await _cache_messages_in_redis(redis, messages)

    return messages
