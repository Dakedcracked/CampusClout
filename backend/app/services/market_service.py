"""
Market Engine service.

  - claim_daily_dividend: grants 10-50 random tokens, once per 24 hours.
  - decay_inactive_users: applies 2% market-cap decay to users inactive > 24h.
    Called nightly by the APScheduler cron.
"""

import logging
import random
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.models.economy import CloutBalance, LoginDividend, TokenTransaction, TransactionType
from app.models.user import User
from app.ws.manager import ws_manager

log = logging.getLogger(__name__)

DIVIDEND_MIN = 10
DIVIDEND_MAX = 50
DECAY_RATE = 0.02  # 2 % per day
INACTIVE_THRESHOLD = timedelta(hours=24)


async def claim_daily_dividend(db: AsyncSession, user_id: uuid.UUID) -> LoginDividend:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=24)

    last = await db.execute(
        select(LoginDividend)
        .where(LoginDividend.user_id == user_id)
        .order_by(LoginDividend.claimed_at.desc())
        .limit(1)
    )
    last_dividend = last.scalar_one_or_none()
    if last_dividend and last_dividend.claimed_at >= cutoff:
        next_available = last_dividend.claimed_at + timedelta(hours=24)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily dividend already claimed. Next available at {next_available.isoformat()}",
        )

    amount = random.randint(DIVIDEND_MIN, DIVIDEND_MAX)

    balance_result = await db.execute(
        select(CloutBalance).where(CloutBalance.user_id == user_id)
    )
    balance = balance_result.scalar_one_or_none()
    if not balance:
        raise HTTPException(status_code=404, detail="Balance not found")

    balance.wallet_balance += amount

    tx = TokenTransaction(
        from_user_id=None,
        to_user_id=user_id,
        amount=amount,
        transaction_type=TransactionType.MINT,
        note="Daily login dividend",
    )
    db.add(tx)

    dividend = LoginDividend(
        user_id=user_id,
        amount=amount,
        claimed_at=now,
    )
    db.add(dividend)

    # Update last_active_at
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user:
        user.last_active_at = now

    await db.commit()
    await db.refresh(dividend)
    return dividend


async def decay_inactive_users() -> None:
    """Nightly cron: reduce market_cap by 2% for users inactive > 24h."""
    async with async_session_factory() as db:
        try:
            cutoff = datetime.now(timezone.utc) - INACTIVE_THRESHOLD
            result = await db.execute(
                select(User, CloutBalance)
                .join(CloutBalance, CloutBalance.user_id == User.id)
                .where(
                    User.is_active == True,
                    CloutBalance.market_cap > 0,
                    (User.last_active_at == None) | (User.last_active_at < cutoff),
                )
            )
            rows = result.all()
            decayed = 0
            for user, balance in rows:
                old_cap = balance.market_cap
                balance.market_cap = round(old_cap * (1 - DECAY_RATE), 2)
                decayed += 1
                await ws_manager.publish_market_cap_event({
                    "event": "market_cap_update",
                    "user_id": str(user.id),
                    "username": user.username,
                    "display_name": user.display_name,
                    "market_cap": balance.market_cap,
                    "tokens_invested_in_me": balance.tokens_invested_in_me,
                    "delta": round(balance.market_cap - old_cap, 2),
                    "delta_pct": round(-DECAY_RATE * 100, 2),
                })
            await db.commit()
            log.info("Market decay applied to %d users", decayed)
        except Exception as exc:
            log.error("Market decay cron failed: %s", exc)
            await db.rollback()
