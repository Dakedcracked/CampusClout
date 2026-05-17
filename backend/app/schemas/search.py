import uuid
from datetime import datetime

from pydantic import BaseModel


class SearchResultUser(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    username: str
    display_name: str | None
    avatar_url: str | None
    bio: str | None
    follower_count: int
    rating_score: float
    rating_count: int


class SearchResultPost(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    author_id: uuid.UUID
    author_username: str
    content: str
    like_count: int
    created_at: datetime


class SearchResultRoom(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    description: str | None
    creator_id: uuid.UUID
    member_count: int
    created_at: datetime


class SearchItem(BaseModel):
    type: str  # 'user' | 'post' | 'room'
    data: SearchResultUser | SearchResultPost | SearchResultRoom


class SearchResponse(BaseModel):
    results: list[SearchItem]
    total: int
