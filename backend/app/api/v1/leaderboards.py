"""Trending profiles and leaderboards endpoints."""

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.services.trending_service import TrendingService, WalletService

router = APIRouter(prefix="/leaderboards", tags=["leaderboards"])


@router.get("/{metric}")
async def get_leaderboard(
    metric: str = Path(..., description="rising-stars, most-invested, hottest, content-kings, store-mvp"),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Get leaderboard by metric."""
    valid_metrics = ["rising-stars", "most-invested", "hottest", "content-kings", "store-mvp"]
    if metric not in valid_metrics:
        raise HTTPException(status_code=400, detail=f"Invalid metric. Valid: {valid_metrics}")

    return await TrendingService.get_leaderboard(db, metric, limit=limit, offset=offset)


# Wallet endpoints
wallet_router = APIRouter(prefix="/wallet", tags=["wallet"])


@wallet_router.get("/balance")
async def get_wallet_balance(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Get user's wallet points balance."""
    user_id = uuid.UUID(get_current_user_id(request))
    wallet = await WalletService.get_or_create_wallet(db, user_id)

    return {
        "balance": wallet.balance,
        "total_earned": wallet.total_earned,
        "total_spent": wallet.total_spent,
    }


@wallet_router.post("/boost")
async def purchase_boost(
    request: Request,
    duration_hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
):
    """Purchase profile boost."""
    user_id = uuid.UUID(get_current_user_id(request))
    success = await WalletService.buy_boost(db, user_id, duration_hours)

    if not success:
        raise HTTPException(status_code=400, detail="Insufficient points. Need 100 points for boost.")

    return {"status": "boost_purchased", "duration_hours": duration_hours}


@wallet_router.post("/transfer")
async def transfer_points(
    to_username: str = Query(..., description="Username to transfer to"),
    amount: int = Query(..., ge=1),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    """Transfer points to another user."""
    from app.models.user import User
    from sqlalchemy import select

    from_user_id = uuid.UUID(get_current_user_id(request))

    # Get recipient user
    recipient_result = await db.execute(
        select(User).where(User.username == to_username)
    )
    recipient = recipient_result.scalar_one_or_none()
    if not recipient:
        raise HTTPException(status_code=404, detail="User not found")

    success = await WalletService.transfer_points(db, from_user_id, recipient.id, amount)

    if not success:
        raise HTTPException(status_code=400, detail="Insufficient points for transfer")

    return {
        "status": "transferred",
        "to_user": to_username,
        "amount_sent": amount,
        "platform_fee": int(amount * 0.25),
        "amount_received": amount - int(amount * 0.25),
    }
