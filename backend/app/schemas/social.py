import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class PostCreate(BaseModel):
    content: str = Field(min_length=1, max_length=500)
    post_as_alter_ego: bool = False
    media_url: str | None = None
    media_type: str | None = None  # "image" or "video"


class PostResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    author_username: str
    author_display_name: str | None
    author_market_cap: float
    content: str
    like_count: int
    comment_count: int = 0
    is_liked_by_me: bool
    rank_score: float
    is_alter_ego_post: bool
    alter_ego_alias: str | None
    media_url: str | None = None
    media_type: str | None = None
    created_at: datetime


class LikeResponse(BaseModel):
    post_id: uuid.UUID
    liked: bool
    new_like_count: int


class MarketCapEvent(BaseModel):
    """Payload broadcast over the WebSocket ticker."""
    event: str = "market_cap_update"
    user_id: str
    username: str
    display_name: str | None
    market_cap: float
    tokens_invested_in_me: int
    delta: float
    delta_pct: float
