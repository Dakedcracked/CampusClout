import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Text, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class GlobalMessage(Base, TimestampMixin):
    """A message in the campus-wide global chatroom."""
    __tablename__ = "global_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_reward: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_rush_hour: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(1024))
    image_type: Mapped[str | None] = mapped_column(String(16))  # "image" | "video"

    sender: Mapped["User"] = relationship("User", back_populates="global_messages")
