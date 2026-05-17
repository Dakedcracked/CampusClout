import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# --- Storefront ---

class StorefrontCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=500)


class StorefrontUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None


class StorefrontResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    owner_id: uuid.UUID
    owner_username: str
    owner_display_name: str | None
    owner_market_cap: float
    name: str
    description: str | None
    is_active: bool
    total_sales_volume: int
    product_count: int
    created_at: datetime


# --- Product ---

class ProductCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    base_price: int = Field(gt=0, description="Base price in Clout Tokens")
    stock_count: int = Field(default=-1, ge=-1, description="-1 = unlimited")


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = None
    base_price: int | None = Field(default=None, gt=0)
    stock_count: int | None = Field(default=None, ge=-1)
    is_active: bool | None = None
    image_url: str | None = None


class ProductResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    storefront_id: uuid.UUID
    name: str
    description: str | None
    base_price: int
    stock_count: int
    is_active: bool
    total_sold: int
    image_url: str | None
    created_at: datetime


class ProductWithPriceResponse(ProductResponse):
    """Product + buyer-specific discount."""
    discount_pct: float
    final_price: int
    tokens_invested: int
    savings: int


# --- Order ---

class OrderResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    buyer_id: uuid.UUID
    product_id: uuid.UUID
    storefront_id: uuid.UUID
    base_price: int
    discount_pct: float
    final_price: int
    tokens_invested_at_purchase: int
    created_at: datetime


class PricePreviewResponse(BaseModel):
    product_id: uuid.UUID
    product_name: str
    base_price: int
    tokens_invested: int
    discount_pct: float
    final_price: int
    savings: int
    can_afford: bool
    wallet_balance: int


class StorefrontEligibility(BaseModel):
    eligible: bool
    market_cap: float
    required_market_cap: float
    message: str
