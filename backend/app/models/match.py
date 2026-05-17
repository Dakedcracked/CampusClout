import uuid
from sqlalchemy import Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

class Match(Base, TimestampMixin):
    __tablename__ = "matches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_a_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    user_b_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    
    green_light_a: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    green_light_b: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Relationships
    user_a: Mapped["User"] = relationship("User", foreign_keys=[user_a_id], viewonly=True)
    user_b: Mapped["User"] = relationship("User", foreign_keys=[user_b_id], viewonly=True)
