"""Add profile impressions tracking table.

Revision ID: 016
Revises: 015
Create Date: 2026-04-29

Creates:
- profile_impressions: tracks profile view events
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "profile_impressions",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True, default=sa.func.gen_random_uuid()),
        sa.Column("visitor_id", PG_UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_user_id", PG_UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("visitor_id", "target_user_id", "created_at", name="uq_profile_impression_daily"),
    )

    # Composite index for fast lookups
    op.create_index(
        "ix_profile_impressions_target_user_created_at",
        "profile_impressions",
        ["target_user_id", sa.desc("created_at")],
        postgresql_using="btree"
    )


def downgrade() -> None:
    op.drop_index("ix_profile_impressions_target_user_created_at", table_name="profile_impressions")
    op.drop_table("profile_impressions")
