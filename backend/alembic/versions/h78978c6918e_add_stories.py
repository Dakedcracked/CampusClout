"""Add stories table

Revision ID: h78978c6918e
Revises: g67867b5807d
Create Date: 2026-05-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'h78978c6918e'
down_revision: Union[str, None] = 'g67867b5807d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'stories',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('media_url', sa.String(length=512), nullable=False),
        sa.Column('media_type', sa.String(length=16), nullable=False, server_default='image'),
        sa.Column('caption', sa.Text(), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index(op.f('ix_stories_author_id'), 'stories', ['author_id'], unique=False)
    op.create_index(op.f('ix_stories_expires_at'), 'stories', ['expires_at'], unique=False)


def downgrade() -> None:
    op.drop_table('stories')
