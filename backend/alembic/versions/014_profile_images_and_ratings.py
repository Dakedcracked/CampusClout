"""Add profile images and user rating system.

Revision ID: 014
Revises: 013
Create Date: 2026-04-29

Adds:
- profile_image_url: user's profile picture
- cover_image_url: profile banner
- rating_score: overall impression rating (0-100)
- rating_count: number of ratings received
- rating_updated_at: last rating calculation time
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add profile image columns
    op.add_column(
        "users",
        sa.Column("profile_image_url", sa.String(512), nullable=True)
    )
    op.add_column(
        "users",
        sa.Column("cover_image_url", sa.String(512), nullable=True)
    )

    # Add rating columns
    op.add_column(
        "users",
        sa.Column("rating_score", sa.Float(), nullable=False, server_default="0.0")
    )
    op.add_column(
        "users",
        sa.Column("rating_count", sa.Integer(), nullable=False, server_default="0")
    )
    op.add_column(
        "users",
        sa.Column("rating_updated_at", sa.DateTime(timezone=True), nullable=True)
    )

    # Create index for fast sorting by rating
    op.create_index(
        "ix_users_rating_score_desc",
        "users",
        [sa.desc("rating_score")],
        postgresql_using="btree"
    )


def downgrade() -> None:
    op.drop_index("ix_users_rating_score_desc", table_name="users")
    op.drop_column("users", "rating_updated_at")
    op.drop_column("users", "rating_count")
    op.drop_column("users", "rating_score")
    op.drop_column("users", "cover_image_url")
    op.drop_column("users", "profile_image_url")
