"""Add user roles and admin features.

Revision ID: 015
Revises: 014
Create Date: 2026-04-29

Adds:
- role: user hierarchy (USER, MEMBER, CO_ADMIN, ADMIN)
- role_assigned_at: when role was assigned
- role_assigned_by: who assigned the role
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM

revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum type for roles
    role_enum = ENUM('USER', 'MEMBER', 'CO_ADMIN', 'ADMIN', name='userrole', create_type=True)
    role_enum.create(op.get_bind(), checkfirst=True)

    # Add role columns
    op.add_column(
        "users",
        sa.Column("role", sa.Enum('USER', 'MEMBER', 'CO_ADMIN', 'ADMIN', name='userrole'), 
                  nullable=False, server_default='USER')
    )
    op.add_column(
        "users",
        sa.Column("role_assigned_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "users",
        sa.Column("role_assigned_by", sa.UUID(as_uuid=True), nullable=True)
    )

    # Add foreign key for role_assigned_by
    op.create_foreign_key(
        "fk_users_role_assigned_by",
        "users",
        "users",
        ["role_assigned_by"],
        ["id"],
        ondelete="SET NULL"
    )

    # Create index for role queries
    op.create_index(
        "ix_users_role",
        "users",
        ["role"],
        postgresql_using="btree"
    )


def downgrade() -> None:
    op.drop_index("ix_users_role", table_name="users")
    op.drop_constraint("fk_users_role_assigned_by", "users", type_="foreignkey")
    op.drop_column("users", "role_assigned_by")
    op.drop_column("users", "role_assigned_at")
    op.drop_column("users", "role")
    
    # Drop enum type
    op.execute("DROP TYPE userrole")
