import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class RatingCreate(BaseModel):
    rated_user_id: uuid.UUID
    score: int = Field(ge=1, le=10)
    note: str | None = Field(None, max_length=500)


class RatingResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    rater_id: uuid.UUID
    rater_username: str
    rater_avatar: str | None
    rated_user_id: uuid.UUID
    impression_score: int
    note: str | None
    created_at: datetime


class UserRatingPublicResponse(BaseModel):
    model_config = {"from_attributes": True}

    rating_score: float
    rating_count: int


class RatingsReceivedResponse(BaseModel):
    ratings: list[RatingResponse]
    total: int


class RatingsGivenResponse(BaseModel):
    ratings: list[RatingResponse]
    total: int


class ViewRecordResponse(BaseModel):
    status: str = "profile_view_recorded"
