"""Beauty score assessments

Revision ID: 008
Revises: 007
Create Date: 2026-04-26
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from alembic import op

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "beauty_scores",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("overall_score", sa.Float, nullable=False),
        sa.Column("skincare_score", sa.Float, nullable=False, server_default="0"),
        sa.Column("style_score", sa.Float, nullable=False, server_default="0"),
        sa.Column("grooming_score", sa.Float, nullable=False, server_default="0"),
        sa.Column("fitness_score", sa.Float, nullable=False, server_default="0"),
        sa.Column("confidence_score", sa.Float, nullable=False, server_default="0"),
        sa.Column("analysis", sa.Text, nullable=False),
        sa.Column("tips", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_beauty_scores_user_id", "beauty_scores", ["user_id"])
    op.create_index("ix_beauty_scores_created_at", "beauty_scores", ["created_at"])


def downgrade() -> None:
    op.drop_table("beauty_scores")
