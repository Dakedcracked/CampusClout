"""Add user ratings table.

Revision ID: 017
Revises: 016
Create Date: 2026-04-29

Creates:
- user_ratings: tracks 1-10 impression ratings between users
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_ratings",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True, default=sa.func.gen_random_uuid()),
        sa.Column("rater_id", PG_UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rated_user_id", PG_UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("impression_score", sa.Integer(), nullable=False),  # 1-10
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("rater_id", "rated_user_id", name="uq_user_rating_per_user"),
    )

    # Composite indexes for fast queries
    op.create_index(
        "ix_user_ratings_rated_user_id",
        "user_ratings",
        ["rated_user_id"],
        postgresql_using="btree"
    )
    op.create_index(
        "ix_user_ratings_created_at",
        "user_ratings",
        [sa.desc("created_at")],
        postgresql_using="btree"
    )


def downgrade() -> None:
    op.drop_index("ix_user_ratings_created_at", table_name="user_ratings")
    op.drop_index("ix_user_ratings_rated_user_id", table_name="user_ratings")
    op.drop_table("user_ratings")
