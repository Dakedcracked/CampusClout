"""Profile votes for trending system and beauty coins

Revision ID: 009
Revises: 008
Create Date: 2026-04-26
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from alembic import op

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "profile_votes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("voter_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vote_type", sa.String(8), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_profile_votes_target_id", "profile_votes", ["target_id"])
    op.create_index("ix_profile_votes_voter_id", "profile_votes", ["voter_id"])
    op.create_index("ix_profile_votes_created_at", "profile_votes", ["created_at"])
    op.create_unique_constraint(
        "uq_profile_vote_daily",
        "profile_votes",
        ["voter_id", "target_id"],
    )

    # beauty_coins column on clout_balances
    op.add_column("clout_balances", sa.Column("beauty_coins", sa.Integer, nullable=False, server_default="0"))

    # vote_score + hot_count + not_count on users (denormalized for fast trending)
    op.add_column("users", sa.Column("hot_count", sa.Integer, nullable=False, server_default="0"))
    op.add_column("users", sa.Column("not_count", sa.Integer, nullable=False, server_default="0"))
    op.add_column("users", sa.Column("vote_score", sa.Float, nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("users", "vote_score")
    op.drop_column("users", "not_count")
    op.drop_column("users", "hot_count")
    op.drop_column("clout_balances", "beauty_coins")
    op.drop_table("profile_votes")
