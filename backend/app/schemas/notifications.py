import uuid
from datetime import datetime

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    notification_type: str
    actor_id: uuid.UUID | None
    actor_username: str | None
    actor_avatar: str | None
    post_id: uuid.UUID | None
    room_id: uuid.UUID | None
    content: str
    is_read: bool
    created_at: datetime


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    total: int


class UnreadCountResponse(BaseModel):
    unread_count: int


class NotificationReadResponse(BaseModel):
    status: str = "notification_marked_as_read"


class NotificationsReadAllResponse(BaseModel):
    status: str = "all_notifications_marked_as_read"
    marked_count: int
