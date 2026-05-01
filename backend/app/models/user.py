import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from enum import Enum as PyEnum


class UserRole(PyEnum):
    USER = "USER"
    MEMBER = "MEMBER"
    CO_ADMIN = "CO_ADMIN"
    ADMIN = "ADMIN"

from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(128), nullable=False)
    university_domain: Mapped[str] = mapped_column(String(128), nullable=False)

    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    display_name: Mapped[str | None] = mapped_column(String(64))
    bio: Mapped[str | None] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(String(512))
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Trending / vote scores (denormalized for fast query)
    hot_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    not_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    vote_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    attractiveness_percentage: Mapped[float] = mapped_column(Float, default=50.0, nullable=False)  # 0-100%
    attractiveness_votes_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # total votes received
    follower_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    following_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Hot profiles scoring (denormalized for fast leaderboard queries)
    hot_score_cached: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    hot_rank_position: Mapped[int | None] = mapped_column(Integer)
    hot_score_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    
    # User rating aggregates (denormalized for fast query)
    rating_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # average rating 1-10
    rating_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # count of ratings received
    
    # User roles and admin features
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.USER, nullable=False, index=True)
    role_assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    role_assigned_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    clout_balance: Mapped["CloutBalance"] = relationship(
        "CloutBalance", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    alter_ego: Mapped["AlterEgo | None"] = relationship(
        "AlterEgo", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    sent_transactions: Mapped[list["TokenTransaction"]] = relationship(
        "TokenTransaction", foreign_keys="TokenTransaction.from_user_id", back_populates="from_user"
    )
    received_transactions: Mapped[list["TokenTransaction"]] = relationship(
        "TokenTransaction", foreign_keys="TokenTransaction.to_user_id", back_populates="to_user"
    )
    engagement_events: Mapped[list["EngagementEvent"]] = relationship(
        "EngagementEvent", back_populates="user", cascade="all, delete-orphan"
    )
    verification_tokens: Mapped[list["EmailVerification"]] = relationship(
        "EmailVerification", back_populates="user", cascade="all, delete-orphan"
    )
    login_dividends: Mapped[list["LoginDividend"]] = relationship(
        "LoginDividend", back_populates="user", cascade="all, delete-orphan"
    )
    global_messages: Mapped[list["GlobalMessage"]] = relationship(
        "GlobalMessage", back_populates="sender", cascade="all, delete-orphan"
    )
    ai_conversation: Mapped["AIConversation | None"] = relationship(
        "AIConversation", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    beauty_scores: Mapped[list["BeautyScore"]] = relationship(
        "BeautyScore", back_populates="user", cascade="all, delete-orphan"
    )
    posts: Mapped[list["Post"]] = relationship(
        "Post", foreign_keys="Post.author_id", back_populates="author", cascade="all, delete-orphan"
    )
    votes_cast: Mapped[list["ProfileVote"]] = relationship(
        "ProfileVote", foreign_keys="ProfileVote.voter_id", back_populates="voter", cascade="all, delete-orphan"
    )
    votes_received: Mapped[list["ProfileVote"]] = relationship(
        "ProfileVote", foreign_keys="ProfileVote.target_id", back_populates="target", cascade="all, delete-orphan"
    )
    following: Mapped[list["Follow"]] = relationship(
        "Follow", foreign_keys="Follow.follower_id", back_populates="follower", cascade="all, delete-orphan"
    )
    followers: Mapped[list["Follow"]] = relationship(
        "Follow", foreign_keys="Follow.following_id", back_populates="following", cascade="all, delete-orphan"
    )
    # Profile impressions and ratings
    profile_images_sent: Mapped[list["ProfileImpression"]] = relationship(
        "ProfileImpression", foreign_keys="ProfileImpression.visitor_id", cascade="all, delete-orphan", viewonly=True
    )
    profile_images_received: Mapped[list["ProfileImpression"]] = relationship(
        "ProfileImpression", foreign_keys="ProfileImpression.target_user_id", cascade="all, delete-orphan", viewonly=True
    )
    ratings_given: Mapped[list["UserRating"]] = relationship(
        "UserRating", foreign_keys="UserRating.rater_id", cascade="all, delete-orphan", viewonly=True
    )
    ratings_received: Mapped[list["UserRating"]] = relationship(
        "UserRating", foreign_keys="UserRating.rated_user_id", cascade="all, delete-orphan", viewonly=True
    )
    # Role assignments
    role_assigned_admin: Mapped[list["User"]] = relationship(
        "User",
        foreign_keys=[role_assigned_by],
        remote_side=[id],
        back_populates="assigned_users",
        viewonly=True
    )
    assigned_users: Mapped[list["User"]] = relationship(
        "User",
        foreign_keys=[role_assigned_by],
        remote_side=[role_assigned_by],
        back_populates="role_assigned_admin",
        viewonly=True
    )
    # Community rooms
    created_rooms: Mapped[list["CommunityRoom"]] = relationship(
        "CommunityRoom", foreign_keys="CommunityRoom.creator_id", back_populates="creator", cascade="all, delete-orphan", viewonly=True
    )
    rooms: Mapped[list["CommunityRoom"]] = relationship(
        "CommunityRoom",
        secondary="room_members",
        primaryjoin="User.id == foreign(room_members.c.member_id)",
        secondaryjoin="CommunityRoom.id == foreign(room_members.c.room_id)",
        viewonly=True
    )
    # Notifications
    sent_notifications: Mapped[list["Notification"]] = relationship(
        "Notification", foreign_keys="Notification.actor_id", back_populates="actor", cascade="all, delete-orphan", viewonly=True
    )
    received_notifications: Mapped[list["Notification"]] = relationship(
        "Notification", foreign_keys="Notification.recipient_id", back_populates="recipient", cascade="all, delete-orphan", viewonly=True
    )
