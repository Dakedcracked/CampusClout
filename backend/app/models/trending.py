"""Trending profiles and wallet points models."""

import uuid
from datetime import datetime

from sqlalchemy import Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ProfileTrendingScore(Base):
    """Stores calculated trending scores for profiles."""

    __tablename__ = "profile_trending_scores"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True, index=True
    )
    market_cap_component: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    hot_ratio_component: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    content_power_component: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    engagement_velocity_component: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    composite_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False, index=True)
    trending_rank: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)


class WalletPoints(Base):
    """User wallet points balance (premium currency)."""

    __tablename__ = "wallet_points"
    __table_args__ = (UniqueConstraint("user_id", name="uq_wallet_points_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    balance: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_earned: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_spent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class PointTransaction(Base):
    """Record of point transfers/purchases."""

    __tablename__ = "point_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    from_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True, index=True
    )
    to_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(50), nullable=False)  # purchase, boost, support
    status: Mapped[str] = mapped_column(String(20), default="completed", nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False, index=True)
