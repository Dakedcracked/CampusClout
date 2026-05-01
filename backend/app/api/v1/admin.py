import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.room import CommunityRoom
from app.models.social import Post
from app.models.user import User, UserRole
from app.schemas.admin import (
    AdminRoleAssignRequest,
    AdminStatsResponse,
    AdminUsersListResponse,
    AdminUserResponse,
    AdminWarnRequest,
    ModerationLogsResponse,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def check_admin(role: UserRole):
    """Dependency to check if user is admin."""
    if role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin role required")


def check_co_admin(role: UserRole):
    """Dependency to check if user is co-admin or admin."""
    if role not in (UserRole.CO_ADMIN, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Co-admin or admin role required")


@router.get("/users", response_model=AdminUsersListResponse)
async def list_users(
    request: Request,
    role: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> AdminUsersListResponse:
    """List users filtered by role (ADMIN only)."""
    admin_id = uuid.UUID(get_current_user_id(request))

    # Check admin role
    admin_result = await db.execute(select(User).where(User.id == admin_id))
    admin_user = admin_result.scalar_one()
    check_admin(admin_user.role)

    # Build query
    query = select(User)
    if role:
        try:
            role_enum = UserRole[role.upper()]
            query = query.where(User.role == role_enum)
        except KeyError:
            raise HTTPException(status_code=400, detail="Invalid role")

    # Count
    count_result = await db.execute(select(func.count(User.id)).select_from(query.alias()))
    total = count_result.scalar() or 0

    # Fetch
    users_result = await db.execute(
        query.order_by(User.created_at.desc()).offset(skip).limit(limit)
    )
    users = users_result.scalars().all()

    return AdminUsersListResponse(
        users=[
            AdminUserResponse(
                id=u.id,
                email=u.email,
                username=u.username,
                display_name=u.display_name,
                role=u.role,
                is_active=u.is_active,
                created_at=u.created_at,
            )
            for u in users
        ],
        total=total,
    )


@router.patch("/users/{user_id}/role", status_code=status.HTTP_200_OK)
async def assign_role(
    user_id: uuid.UUID,
    data: AdminRoleAssignRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Assign role to user (ADMIN only)."""
    admin_id = uuid.UUID(get_current_user_id(request))

    # Check admin role
    admin_result = await db.execute(select(User).where(User.id == admin_id))
    admin_user = admin_result.scalar_one()
    check_admin(admin_user.role)

    # Get target user
    target_result = await db.execute(select(User).where(User.id == user_id))
    target_user = target_result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    target_user.role = data.new_role
    target_user.role_assigned_at = datetime.utcnow()
    target_user.role_assigned_by = admin_id
    await db.commit()

    return {"status": "role_assigned", "new_role": data.new_role}


@router.post("/users/{user_id}/warn", status_code=status.HTTP_200_OK)
async def warn_user(
    user_id: uuid.UUID,
    data: AdminWarnRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Issue warning to user (CO_ADMIN+)."""
    admin_id = uuid.UUID(get_current_user_id(request))

    # Check admin role
    admin_result = await db.execute(select(User).where(User.id == admin_id))
    admin_user = admin_result.scalar_one()
    check_co_admin(admin_user.role)

    # Get target user
    target_result = await db.execute(select(User).where(User.id == user_id))
    target_user = target_result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # In production: create warning record, send email, etc.
    # For now: just return success
    return {"status": "warning_issued", "user_id": user_id, "reason": data.reason}


@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AdminStatsResponse:
    """Get admin dashboard stats (CO_ADMIN+)."""
    admin_id = uuid.UUID(get_current_user_id(request))

    # Check admin role
    admin_result = await db.execute(select(User).where(User.id == admin_id))
    admin_user = admin_result.scalar_one()
    check_co_admin(admin_user.role)

    # Get stats
    total_users_result = await db.execute(select(func.count(User.id)))
    total_users = total_users_result.scalar() or 0

    total_rooms_result = await db.execute(
        select(func.count(CommunityRoom.id)).where(CommunityRoom.is_active == True)
    )
    total_rooms = total_rooms_result.scalar() or 0

    total_posts_result = await db.execute(select(func.count(Post.id)))
    total_posts = total_posts_result.scalar() or 0

    # Active in last 24h
    from datetime import timedelta

    cutoff = datetime.utcnow() - timedelta(hours=24)
    active_24h_result = await db.execute(
        select(func.count(User.id)).where(User.last_active_at >= cutoff)
    )
    active_24h = active_24h_result.scalar() or 0

    return AdminStatsResponse(
        total_users=total_users,
        active_24h=active_24h,
        total_rooms=total_rooms,
        total_posts=total_posts,
        unread_reports=0,  # Placeholder
    )


@router.post("/moderate/posts/{post_id}", status_code=status.HTTP_200_OK)
async def moderate_post(
    post_id: uuid.UUID,
    action: str = Query(...),
    request: Request = ...,
    db: AsyncSession = Depends(get_db),
):
    """Moderate post (CO_ADMIN+) - actions: HIDE, UNHIDE, DELETE."""
    admin_id = uuid.UUID(get_current_user_id(request))

    # Check admin role
    admin_result = await db.execute(select(User).where(User.id == admin_id))
    admin_user = admin_result.scalar_one()
    check_co_admin(admin_user.role)

    # Get post
    post_result = await db.execute(select(Post).where(Post.id == post_id))
    post = post_result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if action == "HIDE":
        post.is_hidden = True
    elif action == "UNHIDE":
        post.is_hidden = False
    elif action == "DELETE":
        await db.delete(post)
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    await db.commit()
    return {"status": f"post_{action.lower()}", "post_id": post_id}


@router.post("/moderate/rooms/{room_id}", status_code=status.HTTP_200_OK)
async def moderate_room(
    room_id: uuid.UUID,
    action: str = Query(...),
    request: Request = ...,
    db: AsyncSession = Depends(get_db),
):
    """Moderate room (CO_ADMIN+) - actions: SUSPEND, REACTIVATE, DELETE."""
    admin_id = uuid.UUID(get_current_user_id(request))

    # Check admin role
    admin_result = await db.execute(select(User).where(User.id == admin_id))
    admin_user = admin_result.scalar_one()
    check_co_admin(admin_user.role)

    # Get room
    room_result = await db.execute(select(CommunityRoom).where(CommunityRoom.id == room_id))
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if action == "SUSPEND":
        room.is_active = False
    elif action == "REACTIVATE":
        room.is_active = True
    elif action == "DELETE":
        await db.delete(room)
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    await db.commit()
    return {"status": f"room_{action.lower()}", "room_id": room_id}


@router.get("/moderation-logs", response_model=ModerationLogsResponse)
async def get_moderation_logs(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> ModerationLogsResponse:
    """Get moderation audit trail (ADMIN only)."""
    admin_id = uuid.UUID(get_current_user_id(request))

    # Check admin role
    admin_result = await db.execute(select(User).where(User.id == admin_id))
    admin_user = admin_result.scalar_one()
    check_admin(admin_user.role)

    # Placeholder: in production, this would query moderation_logs table
    # For now return empty response
    return ModerationLogsResponse(logs=[], total=0)
