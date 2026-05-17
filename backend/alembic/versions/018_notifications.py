"""Add notifications/inbox system.

Revision ID: 018
Revises: 017
Create Date: 2026-04-29

Creates:
- user_notifications: unified inbox for all interactions
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, TEXT

revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum for notification types (with IF NOT EXISTS check)
    op.execute(
        """
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notificationtype') THEN
                CREATE TYPE notificationtype AS ENUM (
                    'LIKE', 'COMMENT', 'FOLLOW', 'RATING', 'AI_SUGGESTION', 'ROOM_INVITE'
                );
            END IF;
        END $$;
        """
    )

    op.create_table(
        "user_notifications",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True, default=sa.func.gen_random_uuid()),
        sa.Column("recipient_id", PG_UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("notification_type", TEXT, nullable=False),  # Store as TEXT, cast to enum in db
        sa.Column("actor_id", PG_UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("post_id", PG_UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=True),
        sa.Column("room_id", PG_UUID(as_uuid=True), nullable=True),  # Will add FK after rooms table created
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Add check constraint instead of enum  
    op.execute(
        """
        ALTER TABLE user_notifications 
        ADD CONSTRAINT check_notification_type 
        CHECK (notification_type IN ('LIKE', 'COMMENT', 'FOLLOW', 'RATING', 'AI_SUGGESTION', 'ROOM_INVITE'))
        """
    )

    # Composite indexes
    op.create_index(
        "ix_user_notifications_recipient_id_is_read",
        "user_notifications",
        ["recipient_id", "is_read"],
        postgresql_using="btree"
    )
    op.create_index(
        "ix_user_notifications_recipient_created_at",
        "user_notifications",
        ["recipient_id", sa.desc("created_at")],
        postgresql_using="btree"
    )


def downgrade() -> None:
    op.drop_index("ix_user_notifications_recipient_created_at", table_name="user_notifications")
    op.drop_index("ix_user_notifications_recipient_id_is_read", table_name="user_notifications")
    op.execute("ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS check_notification_type")
    op.drop_table("user_notifications")
    op.execute("DROP TYPE IF EXISTS notificationtype")
