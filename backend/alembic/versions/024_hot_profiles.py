"""Remove beauty coins and add hot profiles system.

Revision ID: 024
Revises: 023
Create Date: 2026-05-01

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '024'
down_revision: str = '023'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove beauty_coins column from clout_balances
    op.drop_column("clout_balances", "beauty_coins")

    # Add hot profiles scoring columns to users table
    op.add_column(
        "users",
        sa.Column("hot_score_cached", sa.Float(), server_default="0.0", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("hot_rank_position", sa.Integer(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "hot_score_updated_at", sa.DateTime(timezone=True), nullable=True
        ),
    )

    # Create indexes for hot profiles leaderboard
    op.create_index(
        "ix_users_hot_score_cached_desc",
        "users",
        ["hot_score_cached"],
        unique=False,
    )
    op.create_index(
        "ix_users_hot_rank_position",
        "users",
        ["hot_rank_position"],
        unique=False,
    )


def downgrade() -> None:
    # Drop hot profiles columns and indexes
    op.drop_index("ix_users_hot_rank_position", table_name="users")
    op.drop_index("ix_users_hot_score_cached_desc", table_name="users")

    op.drop_column("users", "hot_score_updated_at")
    op.drop_column("users", "hot_rank_position")
    op.drop_column("users", "hot_score_cached")

    # Re-add beauty_coins column
    op.add_column(
        "clout_balances",
        sa.Column("beauty_coins", sa.Integer(), default=0, nullable=False),
    )
