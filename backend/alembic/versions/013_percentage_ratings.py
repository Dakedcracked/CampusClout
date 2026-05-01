"""Add percentage-based attractiveness rating system to users table.

Revision ID: 013
Revises: 012
Create Date: 2026-04-29

Adds:
- attractiveness_percentage (0-100%) field for attractiveness score
- attractiveness_votes_count for total votes received
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add attractiveness percentage column (percentage-based rating 0-100)
    op.add_column(
        "users",
        sa.Column("attractiveness_percentage", sa.Float(), nullable=False, server_default="50.0")
    )

    # Add attractiveness votes count (total votes received)
    op.add_column(
        "users",
        sa.Column("attractiveness_votes_count", sa.Integer(), nullable=False, server_default="0")
    )

    # Create index for fast sorting by attractiveness percentage
    op.create_index(
        "ix_users_attractiveness_percentage_desc",
        "users",
        [sa.desc("attractiveness_percentage")],
        postgresql_using="btree"
    )


def downgrade() -> None:
    # Drop index
    op.drop_index("ix_users_attractiveness_percentage_desc", table_name="users")

    # Drop columns
    op.drop_column("users", "attractiveness_votes_count")
    op.drop_column("users", "attractiveness_percentage")
