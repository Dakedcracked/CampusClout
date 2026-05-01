"""Initial schema: users, clout_balances, transactions, engagement, alter_egos, email_verifications

Revision ID: 001
Revises:
Create Date: 2026-04-26

"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("username", sa.String(32), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(128), nullable=False),
        sa.Column("university_domain", sa.String(128), nullable=False),
        sa.Column("is_verified", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("display_name", sa.String(64)),
        sa.Column("bio", sa.Text),
        sa.Column("avatar_url", sa.String(512)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_username", "users", ["username"])

    op.create_table(
        "clout_balances",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("wallet_balance", sa.Integer, nullable=False, server_default="0"),
        sa.Column("tokens_invested_in_me", sa.Integer, nullable=False, server_default="0"),
        sa.Column("market_cap", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("market_cap_updated_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "token_transactions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("from_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("to_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Integer, nullable=False),
        sa.Column("transaction_type", sa.Enum("MINT", "INVEST", "WITHDRAW", name="transactiontype"), nullable=False),
        sa.Column("note", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_token_tx_from", "token_transactions", ["from_user_id"])
    op.create_index("ix_token_tx_to", "token_transactions", ["to_user_id"])
    op.create_index("ix_token_tx_created_at", "token_transactions", ["created_at"])

    op.create_table(
        "engagement_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.Enum("POST_CREATED", "POST_LIKED", "COMMENT_POSTED", "EVENT_CHECKIN", "PROFILE_VIEWED", name="engagementeventtype"), nullable=False),
        sa.Column("points", sa.Integer, nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_engagement_user_created", "engagement_events", ["user_id", "created_at"])

    op.create_table(
        "alter_egos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("alias", sa.String(32), nullable=False, unique=True),
        sa.Column("avatar_seed", sa.String(64), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "email_verifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(128), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_used", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_email_verifications_token", "email_verifications", ["token"])


def downgrade() -> None:
    op.drop_table("email_verifications")
    op.drop_table("alter_egos")
    op.drop_table("engagement_events")
    op.execute("DROP TYPE IF EXISTS engagementeventtype")
    op.drop_table("token_transactions")
    op.execute("DROP TYPE IF EXISTS transactiontype")
    op.drop_table("clout_balances")
    op.drop_table("users")
