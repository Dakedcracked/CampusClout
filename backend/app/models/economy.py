import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class TransactionType(PyEnum):
    MINT = "MINT"        # System grants tokens (signup bonus, rewards)
    INVEST = "INVEST"    # User A puts tokens into User B's profile
    WITHDRAW = "WITHDRAW"  # User pulls invested tokens back


class EngagementEventType(PyEnum):
    POST_CREATED = "POST_CREATED"
    POST_LIKED = "POST_LIKED"
    COMMENT_POSTED = "COMMENT_POSTED"
    EVENT_CHECKIN = "EVENT_CHECKIN"
    PROFILE_VIEWED = "PROFILE_VIEWED"


class CloutBalance(Base, TimestampMixin):
    """Tracks a user's token holdings and computed market cap."""
    __tablename__ = "clout_balances"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    # Tokens this user holds in their wallet
    wallet_balance: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Sum of all tokens others have invested in this user
    tokens_invested_in_me: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Computed market cap (updated periodically via background job or on transaction)
    market_cap: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    market_cap_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship("User", back_populates="clout_balance")


class TokenTransaction(Base, TimestampMixin):
    """Immutable ledger of every token movement."""
    __tablename__ = "token_transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    from_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    to_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    transaction_type: Mapped[TransactionType] = mapped_column(
        Enum(TransactionType), nullable=False
    )
    note: Mapped[str | None] = mapped_column(String(255))

    from_user: Mapped["User | None"] = relationship(
        "User", foreign_keys=[from_user_id], back_populates="sent_transactions"
    )
    to_user: Mapped["User"] = relationship(
        "User", foreign_keys=[to_user_id], back_populates="received_transactions"
    )


class EngagementEvent(Base, TimestampMixin):
    """Campus activity that contributes to market cap velocity."""
    __tablename__ = "engagement_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[EngagementEventType] = mapped_column(
        Enum(EngagementEventType), nullable=False
    )
    points: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="engagement_events")


class AlterEgo(Base, TimestampMixin):
    """One anonymous profile per user. Linked in DB for moderation."""
    __tablename__ = "alter_egos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    alias: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    avatar_seed: Mapped[str] = mapped_column(String(64), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="alter_ego")


class LoginDividend(Base, TimestampMixin):
    """Records each daily login bonus grant — enforces once-per-24h."""
    __tablename__ = "login_dividends"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    claimed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="login_dividends")


class EmailVerification(Base, TimestampMixin):
    """Short-lived tokens for verifying university email ownership."""
    __tablename__ = "email_verifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="verification_tokens")
