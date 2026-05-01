import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Notification(Base):
    """Unified inbox for all user interactions."""
    __tablename__ = "user_notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    notification_type: Mapped[str] = mapped_column(String(50), nullable=False)  # LIKE, COMMENT, FOLLOW, etc.
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    post_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=True
    )
    room_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("community_rooms.id", ondelete="CASCADE"), nullable=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(nullable=False, index=True)

    recipient: Mapped["User"] = relationship(
        "User",
        foreign_keys=[recipient_id],
        primaryjoin="Notification.recipient_id == User.id",
        back_populates="received_notifications",
        viewonly=True
    )
    actor: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[actor_id],
        primaryjoin="Notification.actor_id == User.id",
        back_populates="sent_notifications",
        viewonly=True
    )
    post: Mapped["Post | None"] = relationship("Post", foreign_keys=[post_id], viewonly=True)  # type: ignore[name-defined]
    room: Mapped["CommunityRoom | None"] = relationship("CommunityRoom", foreign_keys=[room_id], viewonly=True)  # type: ignore[name-defined]
