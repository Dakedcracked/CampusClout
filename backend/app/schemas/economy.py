import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class CloutBalanceResponse(BaseModel):
    model_config = {"from_attributes": True}

    wallet_balance: int
    tokens_invested_in_me: int
    market_cap: float
    market_cap_updated_at: datetime | None


class InvestRequest(BaseModel):
    target_user_id: uuid.UUID
    amount: int = Field(gt=0, description="Tokens to invest in target user")


class WithdrawRequest(BaseModel):
    target_user_id: uuid.UUID
    amount: int = Field(gt=0, description="Tokens to withdraw from target user")


class TransactionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    from_user_id: uuid.UUID | None
    to_user_id: uuid.UUID
    amount: int
    transaction_type: str
    note: str | None
    created_at: datetime


class LeaderboardEntry(BaseModel):
    model_config = {"from_attributes": True}

    rank: int
    user_id: uuid.UUID
    username: str
    display_name: str | None
    market_cap: float
    tokens_invested_in_me: int


class MarketCapResponse(BaseModel):
    user_id: uuid.UUID
    username: str
    market_cap: float
    wallet_balance: int
    tokens_invested_in_me: int
