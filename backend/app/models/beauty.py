import uuid

from sqlalchemy import Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class BeautyScore(Base, TimestampMixin):
    """AI-powered beauty & style assessment result."""
    __tablename__ = "beauty_scores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    overall_score: Mapped[float] = mapped_column(Float, nullable=False)
    skincare_score: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    style_score: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    grooming_score: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    fitness_score: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    analysis: Mapped[str] = mapped_column(Text, nullable=False)
    tips: Mapped[str] = mapped_column(Text, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="beauty_scores")
