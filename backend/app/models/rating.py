import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ProfileImpression(Base):
    """Tracks profile view events between users."""
    __tablename__ = "profile_impressions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    visitor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, index=True
    )

    __table_args__ = (
        UniqueConstraint("visitor_id", "target_user_id", "created_at", name="uq_profile_impression_daily"),
    )

    visitor: Mapped["User"] = relationship(
        "User",
        foreign_keys=[visitor_id],
        primaryjoin="ProfileImpression.visitor_id == User.id",
        viewonly=True
    )
    target_user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[target_user_id],
        primaryjoin="ProfileImpression.target_user_id == User.id",
        viewonly=True
    )


class UserRating(Base):
    """Tracks 1-10 impression ratings between users."""
    __tablename__ = "user_ratings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    rater_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rated_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    impression_score: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-10
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(nullable=False, index=True)

    __table_args__ = (
        UniqueConstraint("rater_id", "rated_user_id", name="uq_user_rating_per_user"),
    )

    rater: Mapped["User"] = relationship(
        "User",
        foreign_keys=[rater_id],
        primaryjoin="UserRating.rater_id == User.id",
        viewonly=True
    )
    rated_user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[rated_user_id],
        primaryjoin="UserRating.rated_user_id == User.id",
        viewonly=True
    )
