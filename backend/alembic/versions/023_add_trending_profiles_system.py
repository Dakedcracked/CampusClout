"""add trending profiles system

Revision ID: 023
Revises: 022
Create Date: 2026-05-01 18:17:41.594507

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '023'
down_revision: Union[str, None] = '022'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('trending_rank', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('has_boost', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('users', sa.Column('boost_expires_at', sa.DateTime(), nullable=True))

    op.create_table(
        'profile_trending_scores',
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('market_cap_component', sa.Float(), server_default='0', nullable=False),
        sa.Column('hot_ratio_component', sa.Float(), server_default='0', nullable=False),
        sa.Column('content_power_component', sa.Float(), server_default='0', nullable=False),
        sa.Column('engagement_velocity_component', sa.Float(), server_default='0', nullable=False),
        sa.Column('composite_score', sa.Float(), server_default='0', nullable=False),
        sa.Column('trending_rank', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('user_id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_profile_trending_scores_composite_score', 'profile_trending_scores', ['composite_score'], unique=False)
    op.create_index('ix_profile_trending_scores_trending_rank', 'profile_trending_scores', ['trending_rank'], unique=False)

    op.create_table(
        'wallet_points',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('balance', sa.Integer(), server_default='0', nullable=False),
        sa.Column('total_earned', sa.Integer(), server_default='0', nullable=False),
        sa.Column('total_spent', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id', name='uq_wallet_points_user'),
    )
    op.create_index('ix_wallet_points_user_id', 'wallet_points', ['user_id'], unique=False)

    op.create_table(
        'point_transactions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('from_user_id', sa.UUID(), nullable=True),
        sa.Column('to_user_id', sa.UUID(), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('transaction_type', sa.String(50), nullable=False),
        sa.Column('status', sa.String(20), server_default='completed', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['from_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['to_user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_point_transactions_from_user', 'point_transactions', ['from_user_id'], unique=False)
    op.create_index('ix_point_transactions_to_user', 'point_transactions', ['to_user_id'], unique=False)
    op.create_index('ix_point_transactions_created_at', 'point_transactions', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_point_transactions_created_at', table_name='point_transactions')
    op.drop_index('ix_point_transactions_to_user', table_name='point_transactions')
    op.drop_index('ix_point_transactions_from_user', table_name='point_transactions')
    op.drop_table('point_transactions')

    op.drop_index('ix_wallet_points_user_id', table_name='wallet_points')
    op.drop_table('wallet_points')

    op.drop_index('ix_profile_trending_scores_trending_rank', table_name='profile_trending_scores')
    op.drop_index('ix_profile_trending_scores_composite_score', table_name='profile_trending_scores')
    op.drop_table('profile_trending_scores')

    op.drop_column('users', 'boost_expires_at')
    op.drop_column('users', 'has_boost')
    op.drop_column('users', 'trending_rank')
