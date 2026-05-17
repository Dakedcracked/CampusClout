"""Add trending pics column

Revision ID: f56756a4796c
Revises: e45746a4796c
Create Date: 2026-05-03 21:12:36.504298

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'f56756a4796c'
down_revision: Union[str, None] = 'e45746a4796c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use JSON instead of arrays, matching our model definition `JSON`
    op.add_column('users', sa.Column('trending_pics', sa.JSON(), server_default='[]', nullable=False))


def downgrade() -> None:
    op.drop_column('users', 'trending_pics')
