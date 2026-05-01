import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, Float, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Post(Base, TimestampMixin):
    """Campus feed post. Author identity may be real or alter-ego."""
    __tablename__ = "posts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    like_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    comment_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rank_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    media_url: Mapped[str | None] = mapped_column(String(1024))
    media_type: Mapped[str | None] = mapped_column(String(16))  # "image" | "video"

    # Alter-ego authorship — real author_id is always stored for moderation
    is_alter_ego_post: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    alter_ego_alias: Mapped[str | None] = mapped_column(String(32))

    author: Mapped["User"] = relationship("User", foreign_keys=[author_id])  # type: ignore[name-defined]
    likes: Mapped[list["PostLike"]] = relationship(
        "PostLike", back_populates="post", cascade="all, delete-orphan"
    )
    comments: Mapped[list["PostComment"]] = relationship(
        "PostComment", back_populates="post", cascade="all, delete-orphan"
    )


class PostLike(Base, TimestampMixin):
    __tablename__ = "post_likes"
    __table_args__ = (UniqueConstraint("user_id", "post_id", name="uq_user_post_like"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False
    )

    user: Mapped["User"] = relationship("User")  # type: ignore[name-defined]
    post: Mapped["Post"] = relationship("Post", back_populates="likes")


class PostComment(Base, TimestampMixin):
    """Comment on a feed post."""
    __tablename__ = "post_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_alter_ego: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    alter_ego_alias: Mapped[str | None] = mapped_column(String(32))

    post: Mapped["Post"] = relationship("Post", back_populates="comments")
    author: Mapped["User"] = relationship("User", foreign_keys=[author_id])  # type: ignore[name-defined]


class Follow(Base, TimestampMixin):
    """Directed follow relationship: follower → following."""
    __tablename__ = "follows"
    __table_args__ = (UniqueConstraint("follower_id", "following_id", name="uq_follow_pair"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    follower_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    following_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    follower: Mapped["User"] = relationship("User", foreign_keys=[follower_id], back_populates="following")  # type: ignore[name-defined]
    following: Mapped["User"] = relationship("User", foreign_keys=[following_id], back_populates="followers")  # type: ignore[name-defined]


class ProfileVote(Base, TimestampMixin):
    """Hot / Not vote on a user's profile. One vote per voter-target pair."""
    __tablename__ = "profile_votes"
    __table_args__ = (UniqueConstraint("voter_id", "target_id", name="uq_profile_vote_daily"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    voter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vote_type: Mapped[str] = mapped_column(String(8), nullable=False)

    voter: Mapped["User"] = relationship("User", foreign_keys=[voter_id], back_populates="votes_cast")  # type: ignore[name-defined]
    target: Mapped["User"] = relationship("User", foreign_keys=[target_id], back_populates="votes_received")  # type: ignore[name-defined]
