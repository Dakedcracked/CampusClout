import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Integer, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class OTPSession(Base, TimestampMixin):
    """Stores OTP codes sent to users for email verification."""
    __tablename__ = "otp_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(254), index=True, nullable=False)
    otp_code: Mapped[str] = mapped_column(String(6), nullable=False)
    
    # Track attempts to prevent brute force
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # User link (optional, if user exists before OTP completion)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )


class TrackingConsent(Base, TimestampMixin):
    """Tracks user's privacy preferences and tracking consent."""
    __tablename__ = "tracking_consents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    
    # Consent flags
    behavior_tracking_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    analytics_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    personalization_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Track consent version for GDPR compliance
    consent_version: Mapped[str] = mapped_column(String(16), default="1.0", nullable=False)
    consented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    user: Mapped["User"] = relationship("User", back_populates="tracking_consent")
