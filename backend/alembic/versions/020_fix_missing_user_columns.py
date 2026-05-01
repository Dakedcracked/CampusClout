"""Add missing user columns (role, rating aggregates).

Revision ID: 020
Revises: 019
Create Date: 2026-04-30

Adds columns that exist in the ORM model but are absent from the database:
- role / role_assigned_at / role_assigned_by  (should have been added by 015)
- rating_score / rating_count                 (added to model, never migrated)
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM, UUID

revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # --- userrole enum ---
    role_enum = ENUM("USER", "MEMBER", "CO_ADMIN", "ADMIN", name="userrole", create_type=False)
    role_enum.create(conn, checkfirst=True)

    # Reflect current columns so we can skip already-existing ones
    inspector = sa.inspect(conn)
    existing = {c["name"] for c in inspector.get_columns("users")}

    if "role" not in existing:
        op.add_column(
            "users",
            sa.Column(
                "role",
                sa.Enum("USER", "MEMBER", "CO_ADMIN", "ADMIN", name="userrole"),
                nullable=False,
                server_default="USER",
            ),
        )
    if "role_assigned_at" not in existing:
        op.add_column(
            "users",
            sa.Column("role_assigned_at", sa.DateTime(timezone=True), nullable=True),
        )
    if "role_assigned_by" not in existing:
        op.add_column(
            "users",
            sa.Column("role_assigned_by", UUID(as_uuid=True), nullable=True),
        )

    # FK and index — only create if the column was just added
    existing_fks = {fk["name"] for fk in inspector.get_foreign_keys("users")}
    if "fk_users_role_assigned_by" not in existing_fks and "role_assigned_by" not in existing:
        op.create_foreign_key(
            "fk_users_role_assigned_by",
            "users",
            "users",
            ["role_assigned_by"],
            ["id"],
            ondelete="SET NULL",
        )

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("users")}
    if "ix_users_role" not in existing_indexes and "role" not in existing:
        op.create_index("ix_users_role", "users", ["role"], postgresql_using="btree")

    # --- rating aggregates ---
    if "rating_score" not in existing:
        op.add_column(
            "users",
            sa.Column("rating_score", sa.Float(), nullable=False, server_default="0.0"),
        )
    if "rating_count" not in existing:
        op.add_column(
            "users",
            sa.Column("rating_count", sa.Integer(), nullable=False, server_default="0"),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing = {c["name"] for c in inspector.get_columns("users")}

    if "rating_count" in existing:
        op.drop_column("users", "rating_count")
    if "rating_score" in existing:
        op.drop_column("users", "rating_score")

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("users")}
    if "ix_users_role" in existing_indexes:
        op.drop_index("ix_users_role", table_name="users")

    existing_fks = {fk["name"] for fk in inspector.get_foreign_keys("users")}
    if "fk_users_role_assigned_by" in existing_fks:
        op.drop_constraint("fk_users_role_assigned_by", "users", type_="foreignkey")

    if "role_assigned_by" in existing:
        op.drop_column("users", "role_assigned_by")
    if "role_assigned_at" in existing:
        op.drop_column("users", "role_assigned_at")
    if "role" in existing:
        op.drop_column("users", "role")

    op.execute("DROP TYPE IF EXISTS userrole")
