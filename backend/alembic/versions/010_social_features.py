"""Social media features: post media, comments, follows

Revision ID: 010
Revises: 009
Create Date: 2026-04-26
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from alembic import op

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Post media support
    op.add_column("posts", sa.Column("media_url", sa.String(1024), nullable=True))
    op.add_column("posts", sa.Column("media_type", sa.String(16), nullable=True))  # image | video
    op.add_column("posts", sa.Column("comment_count", sa.Integer, nullable=False, server_default="0"))

    # Comments
    op.create_table(
        "post_comments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("post_id", UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("is_alter_ego", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("alter_ego_alias", sa.String(32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_post_comments_post_id", "post_comments", ["post_id"])
    op.create_index("ix_post_comments_author_id", "post_comments", ["author_id"])

    # Follows
    op.create_table(
        "follows",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("follower_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("following_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_follows_follower_id", "follows", ["follower_id"])
    op.create_index("ix_follows_following_id", "follows", ["following_id"])
    op.create_unique_constraint("uq_follow_pair", "follows", ["follower_id", "following_id"])

    # Follower counts on users (denormalized)
    op.add_column("users", sa.Column("follower_count", sa.Integer, nullable=False, server_default="0"))
    op.add_column("users", sa.Column("following_count", sa.Integer, nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("users", "following_count")
    op.drop_column("users", "follower_count")
    op.drop_table("follows")
    op.drop_table("post_comments")
    op.drop_column("posts", "comment_count")
    op.drop_column("posts", "media_type")
    op.drop_column("posts", "media_url")
