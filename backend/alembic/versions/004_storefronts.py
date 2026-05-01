"""Storefronts, products, and orders

Revision ID: 004
Revises: 003
Create Date: 2026-04-26

"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "storefronts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("total_sales_volume", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("owner_id", name="uq_storefront_owner"),
    )
    op.create_index("ix_storefronts_owner_id", "storefronts", ["owner_id"])
    op.create_index("ix_storefronts_sales_vol", "storefronts", ["total_sales_volume"])

    op.create_table(
        "products",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("storefront_id", UUID(as_uuid=True), sa.ForeignKey("storefronts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("base_price", sa.Integer, nullable=False),
        sa.Column("stock_count", sa.Integer, nullable=False, server_default="-1"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("total_sold", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_products_storefront_id", "products", ["storefront_id"])

    op.create_table(
        "orders",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("buyer_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("storefront_id", UUID(as_uuid=True), sa.ForeignKey("storefronts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("base_price", sa.Integer, nullable=False),
        sa.Column("discount_pct", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("final_price", sa.Integer, nullable=False),
        sa.Column("tokens_invested_at_purchase", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_orders_buyer_id", "orders", ["buyer_id"])
    op.create_index("ix_orders_storefront_id", "orders", ["storefront_id"])
    op.create_index("ix_orders_created_at", "orders", ["created_at"])


def downgrade() -> None:
    op.drop_table("orders")
    op.drop_table("products")
    op.drop_table("storefronts")
