import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class CommunityRoom(Base, TimestampMixin):
    """Community chat rooms."""
    __tablename__ = "community_rooms"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_password_protected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(256))
    member_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    creator: Mapped["User"] = relationship(
        "User",
        foreign_keys=[creator_id],
        back_populates="created_rooms",
        viewonly=True
    )
    members: Mapped[list["RoomMember"]] = relationship(
        "RoomMember", back_populates="room", cascade="all, delete-orphan"
    )
    messages: Mapped[list["RoomMessage"]] = relationship(
        "RoomMessage", back_populates="room", cascade="all, delete-orphan"
    )


class RoomMember(Base):
    """Membership tracking for community rooms."""
    __tablename__ = "room_members"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("community_rooms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    joined_at: Mapped[datetime] = mapped_column(nullable=False)

    __table_args__ = (
        UniqueConstraint("room_id", "member_id", name="uq_room_member_pair"),
    )

    room: Mapped["CommunityRoom"] = relationship("CommunityRoom", back_populates="members", viewonly=True)
    member: Mapped["User"] = relationship("User", viewonly=True)


class RoomMessage(Base, TimestampMixin):
    """Messages in community rooms."""
    __tablename__ = "room_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("community_rooms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    room: Mapped["CommunityRoom"] = relationship(
        "CommunityRoom", back_populates="messages", viewonly=True
    )
    sender: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[sender_id],
        viewonly=True
    )
