"""Add universities and matches

Revision ID: g67867b5807d
Revises: f56756a4796c
Create Date: 2026-05-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'g67867b5807d'
down_revision: Union[str, None] = 'f56756a4796c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create universities table
    op.create_table(
        'universities',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('domain', sa.String(length=128), nullable=False),
        sa.Column('name', sa.String(length=256), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False)
    )
    op.create_index(op.f('ix_universities_domain'), 'universities', ['domain'], unique=True)
    
    # 2. Add university_id and embedding to users
    op.add_column('users', sa.Column('university_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index(op.f('ix_users_university_id'), 'users', ['university_id'], unique=False)
    op.create_foreign_key('fk_users_university_id', 'users', 'universities', ['university_id'], ['id'], ondelete='SET NULL')
    
    op.add_column('users', sa.Column('embedding', sa.JSON(), nullable=True))
    
    # 3. Create matches table
    op.create_table(
        'matches',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_a_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_b_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('green_light_a', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('green_light_b', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_a_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_b_id'], ['users.id'], ondelete='CASCADE')
    )
    op.create_index(op.f('ix_matches_user_a_id'), 'matches', ['user_a_id'], unique=False)
    op.create_index(op.f('ix_matches_user_b_id'), 'matches', ['user_b_id'], unique=False)


def downgrade() -> None:
    op.drop_table('matches')
    op.drop_constraint('fk_users_university_id', 'users', type_='foreignkey')
    op.drop_index(op.f('ix_users_university_id'), table_name='users')
    op.drop_column('users', 'embedding')
    op.drop_column('users', 'university_id')
    op.drop_table('universities')
