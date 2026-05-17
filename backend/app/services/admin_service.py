"""
Admin and moderation service.

Handles role assignments, user management, and content moderation.
Role hierarchy: USER (0) < MEMBER (1) < CO_ADMIN (2) < ADMIN (3)
"""

import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User, UserRole
from app.models.social import Post
from app.models.room import CommunityRoom


class ModerationAction(PyEnum):
    """Content moderation actions."""
    HIDE = "HIDE"
    UNHIDE = "UNHIDE"
    DELETE = "DELETE"
    WARN = "WARN"
    SUSPEND = "SUSPEND"
    BAN = "BAN"
    REACTIVATE = "REACTIVATE"


ROLE_HIERARCHY = {
    UserRole.USER: 0,
    UserRole.MEMBER: 1,
    UserRole.CO_ADMIN: 2,
    UserRole.ADMIN: 3,
}


async def assign_role(
    db: AsyncSession, admin_id: uuid.UUID, user_id: uuid.UUID, new_role: str
) -> User:
    """Assign a role to a user.
    
    Verify admin has role >= CO_ADMIN.
    """
    # Verify admin is CO_ADMIN or higher
    admin_result = await db.execute(select(User).where(User.id == admin_id))
    admin = admin_result.scalar_one_or_none()
    
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    admin_level = ROLE_HIERARCHY.get(admin.role, 0)
    if admin_level < ROLE_HIERARCHY[UserRole.CO_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to assign roles",
        )
    
    # Verify target user exists
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Assign role
    try:
        user.role = UserRole[new_role.upper()]
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role. Must be one of: {', '.join([r.value for r in UserRole])}",
        )
    
    user.role_assigned_by = admin_id
    user.role_assigned_at = datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(user)
    return user


def get_role_hierarchy() -> dict:
    """Return role hierarchy and permissions."""
    return {
        "USER": {
            "level": 0,
            "permissions": ["view_feed", "create_post", "like_post", "follow_user"],
        },
        "MEMBER": {
            "level": 1,
            "permissions": [
                "view_feed",
                "create_post",
                "like_post",
                "follow_user",
                "create_room",
                "moderate_own_content",
            ],
        },
        "CO_ADMIN": {
            "level": 2,
            "permissions": [
                "view_feed",
                "create_post",
                "like_post",
                "follow_user",
                "create_room",
                "moderate_own_content",
                "assign_member_role",
                "moderate_content",
                "view_admin_stats",
            ],
        },
        "ADMIN": {
            "level": 3,
            "permissions": [
                "view_feed",
                "create_post",
                "like_post",
                "follow_user",
                "create_room",
                "moderate_own_content",
                "assign_any_role",
                "moderate_any_content",
                "ban_users",
                "view_all_admin_stats",
            ],
        },
    }


async def list_users_by_role(
    db: AsyncSession, role: str, skip: int = 0, limit: int = 50
) -> list[dict]:
    """List users by role (paginated)."""
    try:
        role_enum = UserRole[role.upper()]
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role. Must be one of: {', '.join([r.value for r in UserRole])}",
        )
    
    result = await db.execute(
        select(User)
        .where(User.role == role_enum)
        .order_by(User.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    users = result.scalars().all()
    
    return [
        {
            "id": str(u.id),
            "username": u.username,
            "email": u.email,
            "role": u.role.value,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


async def get_admin_stats(db: AsyncSession) -> dict:
    """Return admin dashboard statistics."""
    from sqlalchemy import func
    
    # Count total users
    users_result = await db.execute(select(func.count(User.id)))
    total_users = users_result.scalar() or 0
    
    # Count total posts
    posts_result = await db.execute(select(func.count(Post.id)))
    total_posts = posts_result.scalar() or 0
    
    # Count total rooms
    rooms_result = await db.execute(select(func.count(CommunityRoom.id)))
    total_rooms = rooms_result.scalar() or 0
    
    # Count active users (in last 24h)
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    active_result = await db.execute(
        select(func.count(User.id)).where(User.last_active_at >= cutoff)
    )
    active_24h = active_result.scalar() or 0
    
    # Placeholder for flagged content (would need a flagged_content table)
    flagged_content_count = 0
    
    return {
        "total_users": total_users,
        "total_posts": total_posts,
        "total_rooms": total_rooms,
        "active_24h": active_24h,
        "flagged_content_count": flagged_content_count,
    }


async def moderate_post(
    db: AsyncSession, post_id: uuid.UUID, admin_id: uuid.UUID, action: str
) -> Post:
    """Moderate a post (HIDE, UNHIDE, DELETE)."""
    # Verify admin
    admin_result = await db.execute(select(User).where(User.id == admin_id))
    admin = admin_result.scalar_one_or_none()
    
    if not admin or ROLE_HIERARCHY.get(admin.role, 0) < ROLE_HIERARCHY[UserRole.CO_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    
    post_result = await db.execute(select(Post).where(Post.id == post_id))
    post = post_result.scalar_one_or_none()
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if action not in [a.value for a in ModerationAction]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid action. Must be one of: HIDE, UNHIDE, DELETE",
        )
    
    if action == ModerationAction.DELETE.value:
        await db.delete(post)
    elif action == ModerationAction.HIDE.value:
        # Soft delete logic — would add is_hidden flag if it existed
        pass
    elif action == ModerationAction.UNHIDE.value:
        # Un-hide logic
        pass
    
    await db.commit()
    await db.refresh(post)
    return post


async def moderate_room(
    db: AsyncSession, room_id: uuid.UUID, admin_id: uuid.UUID, action: str
) -> CommunityRoom:
    """Moderate a room (SUSPEND, REACTIVATE, DELETE)."""
    # Verify admin
    admin_result = await db.execute(select(User).where(User.id == admin_id))
    admin = admin_result.scalar_one_or_none()
    
    if not admin or ROLE_HIERARCHY.get(admin.role, 0) < ROLE_HIERARCHY[UserRole.CO_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    
    room_result = await db.execute(select(CommunityRoom).where(CommunityRoom.id == room_id))
    room = room_result.scalar_one_or_none()
    
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if action not in ["SUSPEND", "REACTIVATE", "DELETE"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid action. Must be one of: SUSPEND, REACTIVATE, DELETE",
        )
    
    if action == "DELETE":
        await db.delete(room)
    elif action == "SUSPEND":
        room.is_active = False
    elif action == "REACTIVATE":
        room.is_active = True
    
    await db.commit()
    await db.refresh(room)
    return room


async def moderate_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    admin_id: uuid.UUID,
    action: str,
    reason: str = "",
) -> User:
    """Moderate a user (WARN, SUSPEND, BAN).
    
    Only ADMIN role can BAN. CO_ADMIN and above can WARN/SUSPEND.
    """
    # Verify admin
    admin_result = await db.execute(select(User).where(User.id == admin_id))
    admin = admin_result.scalar_one_or_none()
    
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    admin_level = ROLE_HIERARCHY.get(admin.role, 0)
    if action == "BAN" and admin_level < ROLE_HIERARCHY[UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can ban users",
        )
    elif action in ["WARN", "SUSPEND"] and admin_level < ROLE_HIERARCHY[UserRole.CO_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if action not in ["WARN", "SUSPEND", "BAN"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid action. Must be one of: WARN, SUSPEND, BAN",
        )
    
    if action == "BAN":
        user.is_active = False
    elif action == "SUSPEND":
        user.is_active = False
    # WARN: no action needed, just record moderation event (would add moderation_log table)
    
    await db.commit()
    await db.refresh(user)
    return user
