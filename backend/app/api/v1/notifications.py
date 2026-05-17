import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notifications import (
    NotificationListResponse,
    NotificationReadResponse,
    NotificationResponse,
    NotificationsReadAllResponse,
    UnreadCountResponse,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/inbox", response_model=NotificationListResponse)
async def get_notifications(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    unread_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
) -> NotificationListResponse:
    """Get my notifications (ordered by created_at DESC)."""
    recipient_id = uuid.UUID(get_current_user_id(request))

    query = select(Notification).where(Notification.recipient_id == recipient_id)
    if unread_only:
        query = query.where(Notification.is_read == False)

    # Count total
    count_result = await db.execute(
        select(func.count(Notification.id)).where(Notification.recipient_id == recipient_id)
        if not unread_only
        else select(func.count(Notification.id)).where(
            Notification.recipient_id == recipient_id,
            Notification.is_read == False,
        )
    )
    total = count_result.scalar() or 0

    # Fetch notifications with actor info
    notifications_result = await db.execute(
        query.options(selectinload(Notification.actor))
        .order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    notifications = notifications_result.scalars().all()

    return NotificationListResponse(
        notifications=[
            NotificationResponse(
                id=n.id,
                notification_type=n.notification_type,
                actor_id=n.actor_id,
                actor_username=n.actor.username if n.actor else None,
                actor_avatar=n.actor.avatar_url if n.actor else None,
                post_id=n.post_id,
                room_id=n.room_id,
                content=n.content,
                is_read=n.is_read,
                created_at=n.created_at,
            )
            for n in notifications
        ],
        total=total,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> UnreadCountResponse:
    """Get unread notification count."""
    recipient_id = uuid.UUID(get_current_user_id(request))

    count_result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.recipient_id == recipient_id,
            Notification.is_read == False,
        )
    )
    unread_count = count_result.scalar() or 0

    return UnreadCountResponse(unread_count=unread_count)


@router.post("/{notification_id}/read", response_model=NotificationReadResponse)
async def mark_as_read(
    notification_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> NotificationReadResponse:
    """Mark single notification as read."""
    recipient_id = uuid.UUID(get_current_user_id(request))

    notif_result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.recipient_id == recipient_id,
        )
    )
    notification = notif_result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    await db.commit()

    return NotificationReadResponse()


@router.post("/read-all", response_model=NotificationsReadAllResponse)
async def mark_all_as_read(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> NotificationsReadAllResponse:
    """Mark all notifications as read."""
    recipient_id = uuid.UUID(get_current_user_id(request))

    # Get unread count before marking
    count_result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.recipient_id == recipient_id,
            Notification.is_read == False,
        )
    )
    marked_count = count_result.scalar() or 0

    # Update all unread
    notif_result = await db.execute(
        select(Notification).where(
            Notification.recipient_id == recipient_id,
            Notification.is_read == False,
        )
    )
    notifications = notif_result.scalars().all()
    for n in notifications:
        n.is_read = True
    await db.commit()

    return NotificationsReadAllResponse(marked_count=marked_count)


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Delete notification."""
    recipient_id = uuid.UUID(get_current_user_id(request))

    notif_result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.recipient_id == recipient_id,
        )
    )
    notification = notif_result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    await db.delete(notification)
    await db.commit()
