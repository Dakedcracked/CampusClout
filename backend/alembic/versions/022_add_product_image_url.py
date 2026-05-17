"""add product image url

Revision ID: 022
Revises: 021
Create Date: 2026-05-01 17:50:15.538549

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '022'
down_revision: Union[str, None] = '021'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('products', sa.Column('image_url', sa.String(1024), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'image_url')
