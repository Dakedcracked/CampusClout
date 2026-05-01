"""
Storefront service — Proof-of-Stake commerce.

Discount formula (lifetime loyalty, not affected by withdrawals):

    tokens_invested = SUM of INVEST transactions from buyer → seller
    discount_pct    = min(tokens_invested * 0.1, 40.0)

    final_price = max(1, round(base_price * (1 - discount_pct / 100)))

Examples:
  0 tokens invested  → 0% discount    (full price)
  100 tokens         → 10% discount
  400 tokens         → 40% discount   (maximum)
  1000 tokens        → 40% discount   (capped)

The discount is locked in at purchase time (tokens_invested_at_purchase).
"""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.economy import CloutBalance, TokenTransaction, TransactionType
from app.models.store import Order, Product, Storefront
from app.models.user import User
from app.schemas.store import (
    OrderResponse,
    PricePreviewResponse,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    ProductWithPriceResponse,
    StorefrontCreate,
    StorefrontEligibility,
    StorefrontResponse,
    StorefrontUpdate,
)


# ---------------------------------------------------------------------------
# Discount helpers
# ---------------------------------------------------------------------------

async def _tokens_invested_by(
    db: AsyncSession, buyer_id: uuid.UUID, seller_id: uuid.UUID
) -> int:
    """Lifetime INVEST tokens from buyer → seller (ignores withdrawals — it's a loyalty reward)."""
    result = await db.execute(
        select(func.coalesce(func.sum(TokenTransaction.amount), 0)).where(
            TokenTransaction.from_user_id == buyer_id,
            TokenTransaction.to_user_id == seller_id,
            TokenTransaction.transaction_type == TransactionType.INVEST,
        )
    )
    return int(result.scalar())


def _discount(tokens_invested: int) -> float:
    return min(tokens_invested * 0.1, 40.0)


def _final_price(base_price: int, discount_pct: float) -> int:
    return max(1, round(base_price * (1 - discount_pct / 100)))


# ---------------------------------------------------------------------------
# Eligibility
# ---------------------------------------------------------------------------

async def check_eligibility(
    db: AsyncSession, user_id: uuid.UUID
) -> StorefrontEligibility:
    result = await db.execute(
        select(CloutBalance).where(CloutBalance.user_id == user_id)
    )
    balance = result.scalar_one_or_none()
    cap = balance.market_cap if balance else 0.0
    required = settings.STOREFRONT_MIN_MARKET_CAP
    eligible = cap >= required
    return StorefrontEligibility(
        eligible=eligible,
        market_cap=cap,
        required_market_cap=required,
        message=(
            "Eligible! Open your storefront."
            if eligible
            else f"You need {required - cap:.0f} more market cap. "
                 f"Get others to invest in you."
        ),
    )


# ---------------------------------------------------------------------------
# Storefront CRUD
# ---------------------------------------------------------------------------

async def _storefront_response(sf: Storefront) -> StorefrontResponse:
    cap = sf.owner.clout_balance.market_cap if sf.owner and sf.owner.clout_balance else 0.0
    return StorefrontResponse(
        id=sf.id,
        owner_id=sf.owner_id,
        owner_username=sf.owner.username if sf.owner else "",
        owner_display_name=sf.owner.display_name if sf.owner else None,
        owner_market_cap=cap,
        name=sf.name,
        description=sf.description,
        is_active=sf.is_active,
        total_sales_volume=sf.total_sales_volume,
        product_count=len([p for p in (sf.products or []) if p.is_active]),
        created_at=sf.created_at,
    )


def _sf_options():
    return (
        selectinload(Storefront.owner).selectinload(User.clout_balance),
        selectinload(Storefront.products),
    )


async def create_storefront(
    db: AsyncSession, user_id: uuid.UUID, data: StorefrontCreate
) -> StorefrontResponse:
    eligibility = await check_eligibility(db, user_id)
    if not eligibility.eligible:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=eligibility.message,
        )

    existing = await db.execute(
        select(Storefront).where(Storefront.owner_id == user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a storefront",
        )

    sf = Storefront(owner_id=user_id, name=data.name, description=data.description)
    db.add(sf)
    await db.commit()

    result = await db.execute(
        select(Storefront).where(Storefront.id == sf.id).options(*_sf_options())
    )
    return await _storefront_response(result.scalar_one())


async def get_storefront_by_username(
    db: AsyncSession, username: str
) -> StorefrontResponse:
    user_result = await db.execute(select(User).where(User.username == username.lower()))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    result = await db.execute(
        select(Storefront)
        .where(Storefront.owner_id == user.id, Storefront.is_active == True)
        .options(*_sf_options())
    )
    sf = result.scalar_one_or_none()
    if not sf:
        raise HTTPException(status_code=404, detail="This user has no active storefront")

    return await _storefront_response(sf)


async def get_my_storefront(db: AsyncSession, user_id: uuid.UUID) -> StorefrontResponse | None:
    result = await db.execute(
        select(Storefront).where(Storefront.owner_id == user_id).options(*_sf_options())
    )
    sf = result.scalar_one_or_none()
    return await _storefront_response(sf) if sf else None


async def update_storefront(
    db: AsyncSession, user_id: uuid.UUID, data: StorefrontUpdate
) -> StorefrontResponse:
    result = await db.execute(
        select(Storefront).where(Storefront.owner_id == user_id).options(*_sf_options())
    )
    sf = result.scalar_one_or_none()
    if not sf:
        raise HTTPException(status_code=404, detail="No storefront found")

    if data.name is not None:
        sf.name = data.name
    if data.description is not None:
        sf.description = data.description
    if data.is_active is not None:
        sf.is_active = data.is_active

    await db.commit()
    await db.refresh(sf)
    result2 = await db.execute(
        select(Storefront).where(Storefront.id == sf.id).options(*_sf_options())
    )
    return await _storefront_response(result2.scalar_one())


async def list_storefronts(
    db: AsyncSession, limit: int = 20, offset: int = 0
) -> list[StorefrontResponse]:
    result = await db.execute(
        select(Storefront)
        .where(Storefront.is_active == True)
        .options(*_sf_options())
        .order_by(Storefront.total_sales_volume.desc())
        .limit(limit)
        .offset(offset)
    )
    return [await _storefront_response(sf) for sf in result.scalars().all()]


# ---------------------------------------------------------------------------
# Product CRUD
# ---------------------------------------------------------------------------

async def _get_my_sf(db: AsyncSession, user_id: uuid.UUID) -> Storefront:
    result = await db.execute(
        select(Storefront).where(Storefront.owner_id == user_id)
    )
    sf = result.scalar_one_or_none()
    if not sf:
        raise HTTPException(status_code=404, detail="You don't have a storefront yet")
    return sf


async def add_product(
    db: AsyncSession, user_id: uuid.UUID, data: ProductCreate
) -> ProductResponse:
    sf = await _get_my_sf(db, user_id)
    product = Product(
        storefront_id=sf.id,
        name=data.name,
        description=data.description,
        base_price=data.base_price,
        stock_count=data.stock_count,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return ProductResponse.model_validate(product)


async def update_product(
    db: AsyncSession, user_id: uuid.UUID, product_id: uuid.UUID, data: ProductUpdate
) -> ProductResponse:
    sf = await _get_my_sf(db, user_id)
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.storefront_id == sf.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found in your storefront")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(product, field, value)

    await db.commit()
    await db.refresh(product)
    return ProductResponse.model_validate(product)


async def delete_product(
    db: AsyncSession, user_id: uuid.UUID, product_id: uuid.UUID
) -> None:
    sf = await _get_my_sf(db, user_id)
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.storefront_id == sf.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found in your storefront")
    db.delete(product)
    await db.commit()


async def list_products_with_price(
    db: AsyncSession, storefront_id: uuid.UUID, buyer_id: uuid.UUID | None, owner_id: uuid.UUID
) -> list[ProductWithPriceResponse]:
    result = await db.execute(
        select(Product)
        .where(Product.storefront_id == storefront_id, Product.is_active == True)
        .order_by(Product.created_at.asc())
    )
    products = result.scalars().all()

    invested = await _tokens_invested_by(db, buyer_id, owner_id) if buyer_id else 0
    disc = _discount(invested)

    return [
        ProductWithPriceResponse(
            **ProductResponse.model_validate(p).model_dump(),
            discount_pct=disc,
            final_price=_final_price(p.base_price, disc),
            tokens_invested=invested,
            savings=p.base_price - _final_price(p.base_price, disc),
        )
        for p in products
    ]


# ---------------------------------------------------------------------------
# Price preview & purchase
# ---------------------------------------------------------------------------

async def price_preview(
    db: AsyncSession, buyer_id: uuid.UUID, product_id: uuid.UUID
) -> PricePreviewResponse:
    result = await db.execute(
        select(Product, Storefront)
        .join(Storefront, Product.storefront_id == Storefront.id)
        .where(Product.id == product_id, Product.is_active == True)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Product not found or inactive")
    product, sf = row

    invested = await _tokens_invested_by(db, buyer_id, sf.owner_id)
    disc = _discount(invested)
    final = _final_price(product.base_price, disc)

    bal_result = await db.execute(
        select(CloutBalance).where(CloutBalance.user_id == buyer_id)
    )
    balance = bal_result.scalar_one_or_none()
    wallet = balance.wallet_balance if balance else 0

    return PricePreviewResponse(
        product_id=product.id,
        product_name=product.name,
        base_price=product.base_price,
        tokens_invested=invested,
        discount_pct=disc,
        final_price=final,
        savings=product.base_price - final,
        can_afford=wallet >= final,
        wallet_balance=wallet,
    )


async def purchase(
    db: AsyncSession, buyer_id: uuid.UUID, product_id: uuid.UUID
) -> OrderResponse:
    result = await db.execute(
        select(Product, Storefront)
        .join(Storefront, Product.storefront_id == Storefront.id)
        .where(Product.id == product_id, Product.is_active == True)
        .with_for_update()  # row-level lock to prevent overselling
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Product not found or inactive")
    product, sf = row

    if sf.owner_id == buyer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot buy from your own storefront",
        )

    if product.stock_count == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Product is out of stock",
        )

    invested = await _tokens_invested_by(db, buyer_id, sf.owner_id)
    disc = _discount(invested)
    final = _final_price(product.base_price, disc)

    # Load buyer and seller balances
    buyer_bal_result = await db.execute(
        select(CloutBalance).where(CloutBalance.user_id == buyer_id).with_for_update()
    )
    buyer_balance = buyer_bal_result.scalar_one_or_none()
    if not buyer_balance or buyer_balance.wallet_balance < final:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Insufficient tokens. Purchase costs {final}◈; you have "
                   f"{buyer_balance.wallet_balance if buyer_balance else 0}◈.",
        )

    seller_bal_result = await db.execute(
        select(CloutBalance).where(CloutBalance.user_id == sf.owner_id).with_for_update()
    )
    seller_balance = seller_bal_result.scalar_one_or_none()

    # Execute transfer
    buyer_balance.wallet_balance -= final
    if seller_balance:
        seller_balance.wallet_balance += final

    # Update inventory
    if product.stock_count > 0:
        product.stock_count -= 1
        if product.stock_count == 0:
            product.is_active = False
    product.total_sold += 1
    sf.total_sales_volume += final

    order = Order(
        buyer_id=buyer_id,
        product_id=product.id,
        storefront_id=sf.id,
        base_price=product.base_price,
        discount_pct=disc,
        final_price=final,
        tokens_invested_at_purchase=invested,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return OrderResponse.model_validate(order)


async def my_purchases(db: AsyncSession, buyer_id: uuid.UUID) -> list[OrderResponse]:
    result = await db.execute(
        select(Order)
        .where(Order.buyer_id == buyer_id)
        .order_by(Order.created_at.desc())
        .limit(50)
    )
    return [OrderResponse.model_validate(o) for o in result.scalars().all()]


async def my_sales(db: AsyncSession, owner_id: uuid.UUID) -> list[OrderResponse]:
    sf_result = await db.execute(
        select(Storefront).where(Storefront.owner_id == owner_id)
    )
    sf = sf_result.scalar_one_or_none()
    if not sf:
        return []
    result = await db.execute(
        select(Order)
        .where(Order.storefront_id == sf.id)
        .order_by(Order.created_at.desc())
        .limit(50)
    )
    return [OrderResponse.model_validate(o) for o in result.scalars().all()]
