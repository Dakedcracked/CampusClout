"""
Chat models.

Thread ordering: user_a_id < user_b_id (UUID string comparison) so the pair
has exactly one canonical row — enforced by the UNIQUE constraint and by
chat_service.get_or_create_thread.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ChatThread(Base, TimestampMixin):
    __tablename__ = "chat_threads"
    __table_args__ = (UniqueConstraint("user_a_id", "user_b_id", name="uq_chat_thread_pair"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_a_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    user_b_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_icebreaker_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user_a: Mapped["User"] = relationship("User", foreign_keys=[user_a_id])  # type: ignore
    user_b: Mapped["User"] = relationship("User", foreign_keys=[user_b_id])  # type: ignore
    messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage", back_populates="thread", cascade="all, delete-orphan",
        order_by="ChatMessage.created_at"
    )


class ChatMessage(Base, TimestampMixin):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_threads.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    sender_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_cost: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_ai_icebreaker: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    thread: Mapped["ChatThread"] = relationship("ChatThread", back_populates="messages")
    sender: Mapped["User | None"] = relationship("User", foreign_keys=[sender_id])  # type: ignore
