"""Add community rooms tables.

Revision ID: 019
Revises: 018
Create Date: 2026-04-29

Creates:
- community_rooms: main rooms table
- room_members: membership tracking
- room_messages: room chat messages
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Community Rooms table
    op.create_table(
        "community_rooms",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True, default=sa.func.gen_random_uuid()),
        sa.Column("creator_id", PG_UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_password_protected", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("password_hash", sa.String(256), nullable=True),
        sa.Column("member_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_index(
        "ix_community_rooms_creator_id",
        "community_rooms",
        ["creator_id"],
        postgresql_using="btree"
    )
    op.create_index(
        "ix_community_rooms_is_active_created_at",
        "community_rooms",
        ["is_active", sa.desc("created_at")],
        postgresql_using="btree"
    )

    # Room Members table
    op.create_table(
        "room_members",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True, default=sa.func.gen_random_uuid()),
        sa.Column("room_id", PG_UUID(as_uuid=True), sa.ForeignKey("community_rooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("member_id", PG_UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("room_id", "member_id", name="uq_room_member_pair"),
    )

    op.create_index(
        "ix_room_members_room_id",
        "room_members",
        ["room_id"],
        postgresql_using="btree"
    )
    op.create_index(
        "ix_room_members_member_id",
        "room_members",
        ["member_id"],
        postgresql_using="btree"
    )

    # Room Messages table
    op.create_table(
        "room_messages",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True, default=sa.func.gen_random_uuid()),
        sa.Column("room_id", PG_UUID(as_uuid=True), sa.ForeignKey("community_rooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", PG_UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_index(
        "ix_room_messages_room_id_created_at",
        "room_messages",
        ["room_id", sa.desc("created_at")],
        postgresql_using="btree"
    )
    op.create_index(
        "ix_room_messages_sender_id",
        "room_messages",
        ["sender_id"],
        postgresql_using="btree"
    )

    # Add room_id FK to notifications table
    op.create_foreign_key(
        "fk_user_notifications_room_id",
        "user_notifications",
        "community_rooms",
        ["room_id"],
        ["id"],
        ondelete="CASCADE"
    )


def downgrade() -> None:
    op.drop_constraint("fk_user_notifications_room_id", "user_notifications", type_="foreignkey")
    
    op.drop_index("ix_room_messages_sender_id", table_name="room_messages")
    op.drop_index("ix_room_messages_room_id_created_at", table_name="room_messages")
    op.drop_table("room_messages")

    op.drop_index("ix_room_members_member_id", table_name="room_members")
    op.drop_index("ix_room_members_room_id", table_name="room_members")
    op.drop_table("room_members")

    op.drop_index("ix_community_rooms_is_active_created_at", table_name="community_rooms")
    op.drop_index("ix_community_rooms_creator_id", table_name="community_rooms")
    op.drop_table("community_rooms")
