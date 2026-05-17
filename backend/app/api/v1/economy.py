import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.middleware.rate_limit import enforce_rate_limit
from app.models.economy import CloutBalance
from app.models.user import User
from app.schemas.economy import (
    CloutBalanceResponse,
    InvestRequest,
    LeaderboardEntry,
    MarketCapResponse,
    TransactionResponse,
    WithdrawRequest,
)
from app.services.token_service import get_leaderboard, invest_tokens, withdraw_tokens
from app.services.market_service import claim_daily_dividend

router = APIRouter(prefix="/economy", tags=["economy"])


@router.get("/me/balance", response_model=CloutBalanceResponse)
async def my_balance(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> CloutBalanceResponse:
    user_id = uuid.UUID(get_current_user_id(request))
    result = await db.execute(
        select(CloutBalance).where(CloutBalance.user_id == user_id)
    )
    balance = result.scalar_one_or_none()
    if not balance:
        raise HTTPException(status_code=404, detail="Balance not found")
    return CloutBalanceResponse.model_validate(balance)


@router.get("/user/{username}/market-cap", response_model=MarketCapResponse)
async def user_market_cap(
    username: str,
    db: AsyncSession = Depends(get_db),
) -> MarketCapResponse:
    result = await db.execute(
        select(User)
        .where(User.username == username.lower())
        .options(selectinload(User.clout_balance))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    b = user.clout_balance
    return MarketCapResponse(
        user_id=user.id,
        username=user.username,
        market_cap=b.market_cap if b else 0.0,
        wallet_balance=b.wallet_balance if b else 0,
        tokens_invested_in_me=b.tokens_invested_in_me if b else 0,
    )


@router.post("/invest", response_model=TransactionResponse)
async def invest(
    data: InvestRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    await enforce_rate_limit(request)
    investor_id = uuid.UUID(get_current_user_id(request))
    tx = await invest_tokens(db, investor_id, data.target_user_id, data.amount)
    return TransactionResponse.model_validate(tx)


@router.post("/withdraw", response_model=TransactionResponse)
async def withdraw(
    data: WithdrawRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    await enforce_rate_limit(request)
    investor_id = uuid.UUID(get_current_user_id(request))
    tx = await withdraw_tokens(db, investor_id, data.target_user_id, data.amount)
    return TransactionResponse.model_validate(tx)


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def leaderboard(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
) -> list[LeaderboardEntry]:
    if limit > 100:
        limit = 100
    return await get_leaderboard(db, limit=limit, offset=offset)


@router.post("/daily-dividend")
async def daily_dividend(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(get_current_user_id(request))
    dividend = await claim_daily_dividend(db, user_id)
    return {
        "amount": dividend.amount,
        "claimed_at": dividend.claimed_at.isoformat(),
        "message": f"You earned {dividend.amount} Clout Tokens as your daily login bonus!",
    }
