"""Add engagement tables: post_shares, user_behaviors, daily_streaks,
   and new columns to post_comments (parent_id, like_count, is_deleted).

Revision ID: i89089d7029f
Revises: h78978c6918e
Create Date: 2026-05-04 01:47:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'i89089d7029f'
down_revision: Union[str, None] = 'h78978c6918e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Upgrade post_comments: add threading + like_count + soft-delete ──
    op.add_column('post_comments',
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('post_comments.id', ondelete='CASCADE'), nullable=True))
    op.add_column('post_comments',
        sa.Column('like_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('post_comments',
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'))
    op.create_index('ix_post_comments_parent_id', 'post_comments', ['parent_id'])

    # ── 2. post_shares ─────────────────────────────────────────────────────────
    op.create_table(
        'post_shares',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('post_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
    )

    # ── 3. user_behaviors (AI profiling telemetry) ─────────────────────────────
    op.create_table(
        'user_behaviors',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('event_type', sa.String(64), nullable=False, index=True),
        sa.Column('target_id', sa.String(128), nullable=True),
        sa.Column('metadata_json', sa.Text(), nullable=True),
        sa.Column('session_id', sa.String(64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False, index=True),
    )

    # ── 4. daily_streaks (gamification retention) ──────────────────────────────
    op.create_table(
        'daily_streaks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False,
                  unique=True, index=True),
        sa.Column('current_streak', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('longest_streak', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_checkin_date', sa.Date(), nullable=True),
        sa.Column('total_checkins', sa.Integer(), nullable=False, server_default='0'),
        sa.UniqueConstraint('user_id', name='uq_streak_user'),
    )

    # ── 5. Performance indexes on high-traffic tables ─────────────────────────
    # Composite index for per-author feed queries
    op.create_index('idx_posts_author_created',  'posts',  ['author_id', 'created_at'])
    # Partial index would require raw SQL (unsupported in pure alembic op):
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_posts_rank_score ON posts (rank_score DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_notifications_unread "
        "ON notifications (recipient_id, is_read, created_at DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_user_behaviors_user_event "
        "ON user_behaviors (user_id, event_type, created_at DESC)"
    )


def downgrade() -> None:
    op.drop_table('daily_streaks')
    op.drop_table('user_behaviors')
    op.drop_table('post_shares')
    op.drop_column('post_comments', 'is_deleted')
    op.drop_column('post_comments', 'like_count')
    op.drop_column('post_comments', 'parent_id')
