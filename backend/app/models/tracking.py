import uuid
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import String, DateTime, Integer, Float, ForeignKey, JSON, Enum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class TrackingEventType(PyEnum):
    """Types of tracked user events."""
    PAGE_VIEW = "PAGE_VIEW"
    PROFILE_VIEW = "PROFILE_VIEW"
    POST_VIEW = "POST_VIEW"
    POST_LIKE = "POST_LIKE"
    POST_UNLIKE = "POST_UNLIKE"
    COMMENT_CREATE = "COMMENT_CREATE"
    SEARCH = "SEARCH"
    FOLLOW = "FOLLOW"
    UNFOLLOW = "UNFOLLOW"
    STORY_VIEW = "STORY_VIEW"
    CHAT_MESSAGE = "CHAT_MESSAGE"
    STORE_VIEW = "STORE_VIEW"
    STORE_PURCHASE = "STORE_PURCHASE"
    RATE_PROFILE = "RATE_PROFILE"


class UserTrackingEvent(Base, TimestampMixin):
    """Raw event logs for user behavior tracking (Meta-like system)."""
    __tablename__ = "user_tracking_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    event_type: Mapped[TrackingEventType] = mapped_column(
        Enum(TrackingEventType), index=True, nullable=False
    )
    
    # Event context
    target_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    target_post_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    search_query: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    # Device & Browser Info
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    device_type: Mapped[str | None] = mapped_column(String(32), nullable=True)  # mobile, tablet, desktop
    browser: Mapped[str | None] = mapped_column(String(64), nullable=True)
    os: Mapped[str | None] = mapped_column(String(64), nullable=True)
    
    # Location (IP-based, coarse)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    country: Mapped[str | None] = mapped_column(String(2), nullable=True)  # ISO code
    
    # Engagement metrics
    session_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    time_on_page: Mapped[int | None] = mapped_column(Integer, nullable=True)  # seconds
    
    # Additional event data
    event_data: Mapped[dict] = mapped_column(JSON, default=dict, server_default='{}', nullable=True)
    
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


class UserBehaviorProfile(Base, TimestampMixin):
    """Aggregated user behavior insights (updated daily/hourly)."""
    __tablename__ = "user_behavior_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    
    # Engagement scores (0-100)
    engagement_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    activity_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    social_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    discovery_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    
    # Usage patterns
    total_events: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    unique_days_active: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    avg_session_duration: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # minutes
    peak_activity_hour: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0-23
    
    # Interests (derived from behavior)
    top_interests: Mapped[list[str]] = mapped_column(JSON, default=list, server_default='[]')
    
    # Device preferences
    primary_device: Mapped[str | None] = mapped_column(String(32), nullable=True)
    device_diversity: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # 0-1
    
    # Geographic info
    primary_country: Mapped[str | None] = mapped_column(String(2), nullable=True)
    countries_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Last analysis update
    analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    user: Mapped["User"] = relationship("User", back_populates="behavior_profile")


class UserInterest(Base, TimestampMixin):
    """Derived user interests from behavior patterns."""
    __tablename__ = "user_interests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    
    interest_tag: Mapped[str] = mapped_column(String(64), nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # 0-1
    frequency: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    last_detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    user: Mapped["User"] = relationship("User")
