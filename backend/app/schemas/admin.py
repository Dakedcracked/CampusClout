import uuid
from datetime import datetime
from enum import Enum as PyEnum

from pydantic import BaseModel, Field


class UserRole(str, PyEnum):
    USER = "USER"
    MEMBER = "MEMBER"
    CO_ADMIN = "CO_ADMIN"
    ADMIN = "ADMIN"


class AdminUserResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    email: str
    username: str
    display_name: str | None
    role: UserRole
    is_active: bool
    created_at: datetime


class AdminUsersListResponse(BaseModel):
    users: list[AdminUserResponse]
    total: int


class AdminRoleAssignRequest(BaseModel):
    new_role: UserRole


class AdminWarnRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class AdminStatsResponse(BaseModel):
    total_users: int
    active_24h: int
    total_rooms: int
    total_posts: int
    unread_reports: int


class AdminModerationActionRequest(BaseModel):
    pass  # action is a query parameter


class AdminModerationResponse(BaseModel):
    status: str


class ModerationLogEntry(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    admin_id: uuid.UUID
    admin_username: str
    action: str
    target_type: str  # 'post' | 'room' | 'user'
    target_id: uuid.UUID
    reason: str | None
    created_at: datetime


class ModerationLogsResponse(BaseModel):
    logs: list[ModerationLogEntry]
    total: int
