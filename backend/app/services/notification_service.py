"""
Unified notification/inbox service.

Manages user notifications across likes, comments, follows, and more.
Supports marking as read and auto-creation for common events.
"""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.notification import Notification
from app.models.user import User
from app.models.social import Post, PostLike, PostComment, Follow
from app.models.room import CommunityRoom


async def create_notification(
    db: AsyncSession,
    recipient_id: uuid.UUID,
    notif_type: str,
    actor_id: uuid.UUID | None = None,
    post_id: uuid.UUID | None = None,
    room_id: uuid.UUID | None = None,
    content: str = "",
) -> Notification:
    """Create a notification for a user.
    
    Args:
        recipient_id: User receiving the notification
        notif_type: Type of notification (LIKE, COMMENT, FOLLOW, etc.)
        actor_id: User causing the notification
        post_id: Related post (if applicable)
        room_id: Related room (if applicable)
        content: Notification message
    """
    notification = Notification(
        recipient_id=recipient_id,
        notification_type=notif_type,
        actor_id=actor_id,
        post_id=post_id,
        room_id=room_id,
        content=content,
        is_read=False,
        created_at=datetime.now(timezone.utc),
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification


async def get_inbox(
    db: AsyncSession,
    recipient_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    unread_only: bool = False,
) -> list[dict]:
    """Get paginated notifications for a user.
    
    Args:
        recipient_id: User whose inbox to fetch
        skip: Pagination offset
        limit: Pagination limit
        unread_only: If True, only return unread notifications
    """
    query = select(Notification).where(Notification.recipient_id == recipient_id)
    
    if unread_only:
        query = query.where(Notification.is_read == False)
    
    query = (
        query.order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
        .options(selectinload(Notification.actor), selectinload(Notification.post))
    )
    
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    return [
        {
            "id": str(n.id),
            "type": n.notification_type,
            "content": n.content,
            "is_read": n.is_read,
            "actor": {
                "id": str(n.actor.id),
                "username": n.actor.username,
                "avatar_url": n.actor.avatar_url,
            } if n.actor else None,
            "post": {
                "id": str(n.post.id),
                "content": n.post.content[:50],
            } if n.post else None,
            "room": {
                "id": str(n.room.id),
                "name": n.room.name,
            } if n.room else None,
            "created_at": n.created_at.isoformat(),
        }
        for n in notifications
    ]


async def get_unread_count(db: AsyncSession, recipient_id: uuid.UUID) -> int:
    """Get count of unread notifications for a user."""
    result = await db.execute(
        select(func.count(Notification.id)).where(
            and_(
                Notification.recipient_id == recipient_id,
                Notification.is_read == False,
            )
        )
    )
    return result.scalar() or 0


async def mark_as_read(db: AsyncSession, notification_id: uuid.UUID) -> Notification:
    """Mark a single notification as read."""
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id)
    )
    notif = result.scalar_one_or_none()
    
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notif.is_read = True
    await db.commit()
    await db.refresh(notif)
    return notif


async def mark_all_as_read(db: AsyncSession, recipient_id: uuid.UUID) -> int:
    """Mark all unread notifications as read. Returns count updated."""
    result = await db.execute(
        select(Notification).where(
            and_(
                Notification.recipient_id == recipient_id,
                Notification.is_read == False,
            )
        )
    )
    notifications = result.scalars().all()
    
    for notif in notifications:
        notif.is_read = True
    
    await db.commit()
    return len(notifications)


async def delete_notification(db: AsyncSession, notification_id: uuid.UUID) -> None:
    """Delete a notification."""
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id)
    )
    notif = result.scalar_one_or_none()
    
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    await db.delete(notif)
    await db.commit()


async def auto_create_notification_for_like(
    db: AsyncSession, post_id: uuid.UUID, liker_id: uuid.UUID
) -> Notification | None:
    """Auto-create a LIKE notification to post author (if not the liker)."""
    post_result = await db.execute(select(Post).where(Post.id == post_id))
    post = post_result.scalar_one_or_none()
    
    if not post or post.author_id == liker_id:
        return None
    
    # Get liker info
    liker_result = await db.execute(select(User).where(User.id == liker_id))
    liker = liker_result.scalar_one_or_none()
    
    return await create_notification(
        db,
        recipient_id=post.author_id,
        notif_type="LIKE",
        actor_id=liker_id,
        post_id=post_id,
        content=f"{liker.username if liker else 'Someone'} liked your post",
    )


async def auto_create_notification_for_comment(
    db: AsyncSession, post_id: uuid.UUID, commenter_id: uuid.UUID
) -> Notification | None:
    """Auto-create a COMMENT notification to post author (if not the commenter)."""
    post_result = await db.execute(select(Post).where(Post.id == post_id))
    post = post_result.scalar_one_or_none()
    
    if not post or post.author_id == commenter_id:
        return None
    
    # Get commenter info
    commenter_result = await db.execute(select(User).where(User.id == commenter_id))
    commenter = commenter_result.scalar_one_or_none()
    
    return await create_notification(
        db,
        recipient_id=post.author_id,
        notif_type="COMMENT",
        actor_id=commenter_id,
        post_id=post_id,
        content=f"{commenter.username if commenter else 'Someone'} commented on your post",
    )


async def auto_create_notification_for_follow(
    db: AsyncSession, follower_id: uuid.UUID, following_id: uuid.UUID
) -> Notification:
    """Auto-create a FOLLOW notification to followed user."""
    follower_result = await db.execute(select(User).where(User.id == follower_id))
    follower = follower_result.scalar_one_or_none()
    
    return await create_notification(
        db,
        recipient_id=following_id,
        notif_type="FOLLOW",
        actor_id=follower_id,
        content=f"{follower.username if follower else 'Someone'} started following you",
    )


# Import at end to avoid circular imports
from sqlalchemy import func
