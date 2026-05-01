import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class RoomMemberInfo(BaseModel):
    model_config = {"from_attributes": True}

    member_id: uuid.UUID
    username: str
    display_name: str | None
    avatar_url: str | None
    joined_at: datetime


class RoomMessageResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    sender_id: uuid.UUID | None
    sender_username: str | None
    sender_avatar: str | None
    content: str
    is_pinned: bool
    created_at: datetime


class RoomDetailResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    description: str | None
    creator_id: uuid.UUID
    creator_username: str
    member_count: int
    is_password_protected: bool
    is_active: bool
    created_at: datetime


class RoomListResponse(BaseModel):
    rooms: list[RoomDetailResponse]
    total: int


class RoomMembersResponse(BaseModel):
    members: list[RoomMemberInfo]
    total: int


class RoomMessagesResponse(BaseModel):
    messages: list[RoomMessageResponse]
    total: int


class RoomCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    is_password_protected: bool = False
    password: str | None = Field(None, max_length=100)


class RoomJoinRequest(BaseModel):
    password: str | None = None


class RoomMessageCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=1000)


class RoomMessagePinResponse(BaseModel):
    status: str = "message_pinned"


class RoomLeaveResponse(BaseModel):
    status: str = "left_room"
