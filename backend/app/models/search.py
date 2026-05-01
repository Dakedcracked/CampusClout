import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class SearchIndex(Base):
    """Full-text search index for users, posts, and rooms."""
    __tablename__ = "search_index"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    indexed_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    indexed_post_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=True
    )
    indexed_room_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("community_rooms.id", ondelete="CASCADE"), nullable=True
    )
    search_text: Mapped[str] = mapped_column(Text, nullable=False)
    search_category: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # USER, POST, ROOM
    updated_at: Mapped[datetime] = mapped_column(nullable=False)

    user: Mapped["User | None"] = relationship("User", foreign_keys=[indexed_user_id], viewonly=True)  # type: ignore[name-defined]
    post: Mapped["Post | None"] = relationship("Post", foreign_keys=[indexed_post_id], viewonly=True)  # type: ignore[name-defined]
    room: Mapped["CommunityRoom | None"] = relationship("CommunityRoom", foreign_keys=[indexed_room_id], viewonly=True)  # type: ignore[name-defined]
