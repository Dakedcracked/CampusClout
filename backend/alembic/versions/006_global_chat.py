"""Global campus chat and Rush Hour messages

Revision ID: 006
Revises: 005
Create Date: 2026-04-26
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "global_messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("sender_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("token_reward", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_rush_hour", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_global_messages_sender_id", "global_messages", ["sender_id"])
    op.create_index("ix_global_messages_created_at", "global_messages", ["created_at"])


def downgrade() -> None:
    op.drop_table("global_messages")
