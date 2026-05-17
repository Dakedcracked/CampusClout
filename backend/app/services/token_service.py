"""
Token economy service.

Market cap formula:
    market_cap = tokens_invested_in_me
                 * velocity_multiplier   (1 + min(tx_7d / max(wallet,1), 2.0) * 0.5)
                 * engagement_multiplier (1 + min(engagement_7d / 100, 1.0) * 0.3)

A dormant user with 1000 tokens invested earns cap = 1000.
An active user with same base can reach up to 1000 * 1.5 * 1.3 = 1950.
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.economy import (
    CloutBalance,
    EngagementEvent,
    TokenTransaction,
    TransactionType,
)
from app.models.user import User
from app.schemas.economy import LeaderboardEntry
from app.ws.manager import ws_manager


async def _get_balance(db: AsyncSession, user_id: uuid.UUID) -> CloutBalance:
    result = await db.execute(
        select(CloutBalance).where(CloutBalance.user_id == user_id)
    )
    balance = result.scalar_one_or_none()
    if not balance:
        raise HTTPException(status_code=404, detail="Clout balance record not found")
    return balance


async def invest_tokens(
    db: AsyncSession, investor_id: uuid.UUID, target_id: uuid.UUID, amount: int
) -> TokenTransaction:
    if investor_id == target_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot invest in yourself",
        )

    investor_balance = await _get_balance(db, investor_id)

    max_allowed = int(investor_balance.wallet_balance * settings.MAX_INVEST_PERCENTAGE)
    if amount > max_allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot invest more than {settings.MAX_INVEST_PERCENTAGE*100:.0f}% of your balance "
                   f"({max_allowed} tokens) in a single user",
        )
    if amount > investor_balance.wallet_balance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient balance. You have {investor_balance.wallet_balance} tokens",
        )

    target_balance = await _get_balance(db, target_id)

    investor_balance.wallet_balance -= amount
    target_balance.tokens_invested_in_me += amount

    tx = TokenTransaction(
        from_user_id=investor_id,
        to_user_id=target_id,
        amount=amount,
        transaction_type=TransactionType.INVEST,
        note=f"Investment of {amount} tokens",
    )
    db.add(tx)

    old_cap = target_balance.market_cap
    await _recalculate_market_cap(db, target_id, target_balance)
    await db.commit()
    await db.refresh(tx)
    await _publish_cap_event(db, target_id, old_cap, target_balance)
    return tx


async def withdraw_tokens(
    db: AsyncSession, investor_id: uuid.UUID, target_id: uuid.UUID, amount: int
) -> TokenTransaction:
    """Pull back tokens previously invested into target user."""
    total_invested = await _total_invested_by(db, investor_id, target_id)
    if amount > total_invested:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You have only {total_invested} tokens invested in this user",
        )

    investor_balance = await _get_balance(db, investor_id)
    target_balance = await _get_balance(db, target_id)

    investor_balance.wallet_balance += amount
    target_balance.tokens_invested_in_me = max(
        0, target_balance.tokens_invested_in_me - amount
    )

    tx = TokenTransaction(
        from_user_id=investor_id,
        to_user_id=investor_id,  # tokens return to investor
        amount=amount,
        transaction_type=TransactionType.WITHDRAW,
        note=f"Withdrawal of {amount} tokens from user {target_id}",
    )
    db.add(tx)

    old_cap = target_balance.market_cap
    await _recalculate_market_cap(db, target_id, target_balance)
    await db.commit()
    await db.refresh(tx)
    await _publish_cap_event(db, target_id, old_cap, target_balance)
    return tx


async def _publish_cap_event(
    db: AsyncSession,
    user_id: uuid.UUID,
    old_cap: float,
    balance: CloutBalance,
) -> None:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return
    new_cap = balance.market_cap
    delta = round(new_cap - old_cap, 2)
    delta_pct = round((delta / max(old_cap, 1)) * 100, 2)
    await ws_manager.publish_market_cap_event({
        "event": "market_cap_update",
        "user_id": str(user.id),
        "username": user.username,
        "display_name": user.display_name,
        "market_cap": new_cap,
        "tokens_invested_in_me": balance.tokens_invested_in_me,
        "delta": delta,
        "delta_pct": delta_pct,
    })


async def _total_invested_by(
    db: AsyncSession, investor_id: uuid.UUID, target_id: uuid.UUID
) -> int:
    """Sum of INVEST minus WITHDRAW between these two users."""
    invested_q = await db.execute(
        select(func.coalesce(func.sum(TokenTransaction.amount), 0)).where(
            TokenTransaction.from_user_id == investor_id,
            TokenTransaction.to_user_id == target_id,
            TokenTransaction.transaction_type == TransactionType.INVEST,
        )
    )
    withdrawn_q = await db.execute(
        select(func.coalesce(func.sum(TokenTransaction.amount), 0)).where(
            TokenTransaction.from_user_id == investor_id,
            TokenTransaction.to_user_id == investor_id,
            TokenTransaction.transaction_type == TransactionType.WITHDRAW,
            # Note: this is a simplification — for prod use a separate investment-position table
        )
    )
    return max(0, invested_q.scalar() - withdrawn_q.scalar())


async def _recalculate_market_cap(
    db: AsyncSession, user_id: uuid.UUID, balance: CloutBalance
) -> None:
    window = datetime.now(timezone.utc) - timedelta(days=7)

    # Token velocity: total tokens transacted in last 7 days
    tx_vol_result = await db.execute(
        select(func.coalesce(func.sum(TokenTransaction.amount), 0)).where(
            (TokenTransaction.from_user_id == user_id)
            | (TokenTransaction.to_user_id == user_id),
            TokenTransaction.created_at >= window,
        )
    )
    tx_7d: int = tx_vol_result.scalar()

    # Engagement: sum of event points in last 7 days
    eng_result = await db.execute(
        select(func.coalesce(func.sum(EngagementEvent.points), 0)).where(
            EngagementEvent.user_id == user_id,
            EngagementEvent.created_at >= window,
        )
    )
    engagement_7d: int = eng_result.scalar()

    wallet = max(balance.wallet_balance, 1)
    velocity = min(tx_7d / wallet, 2.0)
    velocity_multiplier = 1 + velocity * 0.5

    engagement_score = min(engagement_7d / 100, 1.0)
    engagement_multiplier = 1 + engagement_score * 0.3

    balance.market_cap = round(
        balance.tokens_invested_in_me * velocity_multiplier * engagement_multiplier, 2
    )
    balance.market_cap_updated_at = datetime.now(timezone.utc)


async def get_leaderboard(
    db: AsyncSession, limit: int = 50, offset: int = 0
) -> list[LeaderboardEntry]:
    result = await db.execute(
        select(User, CloutBalance)
        .join(CloutBalance, CloutBalance.user_id == User.id)
        .where(User.is_active == True)
        .order_by(CloutBalance.market_cap.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = result.all()
    entries = []
    for rank_offset, (user, balance) in enumerate(rows):
        entries.append(
            LeaderboardEntry(
                rank=offset + rank_offset + 1,
                user_id=user.id,
                username=user.username,
                display_name=user.display_name,
                market_cap=balance.market_cap,
                tokens_invested_in_me=balance.tokens_invested_in_me,
            )
        )
    return entries
