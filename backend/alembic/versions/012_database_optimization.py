"""Database optimization for chat scalability and trending performance.

Revision ID: 012
Revises: 011
Create Date: 2026-04-29

Adds:
- Cache fields to users table for trending calculations
- Composite indexes for trending and chat queries
- Archive table for old global messages
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # Add cache fields to users table for trending calculations
    op.add_column('users', sa.Column('trending_score_cached', sa.Float(), nullable=True))
    op.add_column('users', sa.Column('beauty_score_cached', sa.Float(), nullable=True))
    op.add_column('users', sa.Column('engagement_7d_cached', sa.Integer(), nullable=True, server_default='0'))

    # Create composite indexes for efficient trending queries
    op.create_index(
        'ix_users_trending_score_cached_desc',
        'users',
        [sa.desc('trending_score_cached')],
        postgresql_using='btree'
    )

    op.create_index(
        'ix_users_beauty_score_cached_desc',
        'users',
        [sa.desc('beauty_score_cached')],
        postgresql_using='btree'
    )

    # Optimize chat_threads queries
    op.create_index(
        'ix_chat_threads_user_a_created',
        'chat_threads',
        ['user_a_id', sa.desc('last_message_at')],
        postgresql_using='btree'
    )

    op.create_index(
        'ix_chat_threads_user_b_created',
        'chat_threads',
        ['user_b_id', sa.desc('last_message_at')],
        postgresql_using='btree'
    )

    # Create archive table for global messages older than 30 days
    op.create_table(
        'global_messages_archive',
        sa.Column('id', postgresql.UUID(), nullable=False),
        sa.Column('sender_id', postgresql.UUID(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('token_reward', sa.Integer(), nullable=True),
        sa.Column('is_rush_hour', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    # Index archive table for efficient lookups
    op.create_index(
        'ix_global_messages_archive_sender_id',
        'global_messages_archive',
        ['sender_id'],
        postgresql_using='btree'
    )
    op.create_index(
        'ix_global_messages_archive_created_at',
        'global_messages_archive',
        [sa.desc('created_at')],
        postgresql_using='btree'
    )


def downgrade():
    # Drop archive table and indexes
    op.drop_index('ix_global_messages_archive_created_at', table_name='global_messages_archive')
    op.drop_index('ix_global_messages_archive_sender_id', table_name='global_messages_archive')
    op.drop_table('global_messages_archive')

    # Drop chat_threads indexes
    op.drop_index('ix_chat_threads_user_b_created', table_name='chat_threads')
    op.drop_index('ix_chat_threads_user_a_created', table_name='chat_threads')

    # Drop trending indexes
    op.drop_index('ix_users_beauty_score_cached_desc', table_name='users')
    op.drop_index('ix_users_trending_score_cached_desc', table_name='users')

    # Remove cache columns from users
    op.drop_column('users', 'engagement_7d_cached')
    op.drop_column('users', 'beauty_score_cached')
    op.drop_column('users', 'trending_score_cached')
