"""
UserBehavior — behavioral telemetry for AI profiling and ad-targeting.
DailyStreak  — gamification retention hook.
"""
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class UserBehavior(Base):
    """Every significant user action is recorded here for the AI profiling engine."""
    __tablename__ = "user_behaviors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # target_id is the entity acted on (post_id, username, room_id, etc.)
    target_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # JSON payload — search query, duration, reaction type, etc.
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    session_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.utcnow(), index=True
    )

    user: Mapped["User"] = relationship("User", viewonly=True)  # type: ignore[name-defined]


class DailyStreak(Base):
    """Login streak tracker — drives daily return through loss-aversion."""
    __tablename__ = "daily_streaks"
    __table_args__ = (UniqueConstraint("user_id", name="uq_streak_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    current_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_checkin_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    total_checkins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    user: Mapped["User"] = relationship("User", viewonly=True)  # type: ignore[name-defined]
