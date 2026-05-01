"""Hot profiles API endpoints."""

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.services.hot_profiles_service import (
    get_hot_profiles,
    get_hot_score_breakdown,
)

router = APIRouter(prefix="/hot-profiles", tags=["hot-profiles"])


@router.get("/top")
async def get_top_hot_profiles(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Get top hot profiles by hot score.

    Returns list of users ranked by attractiveness based on:
    - 35% Beauty Score (AI analysis)
    - 25% Engagement Power (likes, comments, posts)
    - 20% Velocity (growth momentum)
    - 20% Quality Score (profile completeness)
    """
    profiles = await get_hot_profiles(db, limit=limit, offset=offset)
    return {
        "profiles": profiles,
        "total": len(profiles),
        "limit": limit,
        "offset": offset,
    }


@router.get("/{username}/breakdown")
async def get_hot_score_breakdown_endpoint(
    username: str,
    request=None,
    db: AsyncSession = Depends(get_db),
):
    """Get detailed hot score breakdown for a user.

    Shows all 4 components and how they're weighted.
    """
    from sqlalchemy import select
    from app.models.user import User

    # Find user by username
    result = await db.execute(select(User).where(User.username == username.lower()))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    breakdown = await get_hot_score_breakdown(db, user.id)
    return {
        "username": username,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        **breakdown,
    }


@router.get("/rank/{username}")
async def get_user_hot_rank(
    username: str,
    db: AsyncSession = Depends(get_db),
):
    """Get user's hot rank position."""
    from sqlalchemy import select
    from app.models.user import User

    result = await db.execute(select(User).where(User.username == username.lower()))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return {
        "username": username,
        "hot_score": user.hot_score_cached,
        "rank_position": user.hot_rank_position,
        "rank_percentile": (
            ((1000 - (user.hot_rank_position or 1000)) / 1000.0) * 100
            if user.hot_rank_position
            else 0.0
        ),
    }
