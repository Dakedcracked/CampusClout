"""
Storefront models.

Storefronts are gated behind a minimum market_cap threshold (configurable).
Orders record the discount the buyer earned through lifetime token investment
in the seller — so the discount never expires even if they withdraw tokens later.

stock_count == -1 means unlimited inventory.
"""

import uuid

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Storefront(Base, TimestampMixin):
    __tablename__ = "storefronts"
    __table_args__ = (UniqueConstraint("owner_id", name="uq_storefront_owner"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    total_sales_volume: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    owner: Mapped["User"] = relationship("User")  # type: ignore
    products: Mapped[list["Product"]] = relationship(
        "Product", back_populates="storefront", cascade="all, delete-orphan"
    )


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    storefront_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("storefronts.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    base_price: Mapped[int] = mapped_column(Integer, nullable=False)  # tokens
    stock_count: Mapped[int] = mapped_column(Integer, default=-1, nullable=False)  # -1 = unlimited
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    total_sold: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(1024))

    storefront: Mapped["Storefront"] = relationship("Storefront", back_populates="products")
    orders: Mapped[list["Order"]] = relationship(
        "Order", back_populates="product", cascade="all, delete-orphan"
    )


class Order(Base, TimestampMixin):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    buyer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    storefront_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("storefronts.id", ondelete="CASCADE"),
        nullable=False
    )
    base_price: Mapped[int] = mapped_column(Integer, nullable=False)
    discount_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    final_price: Mapped[int] = mapped_column(Integer, nullable=False)
    tokens_invested_at_purchase: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    buyer: Mapped["User"] = relationship("User", foreign_keys=[buyer_id])  # type: ignore
    product: Mapped["Product"] = relationship("Product", back_populates="orders")
    storefront: Mapped["Storefront"] = relationship("Storefront")
