import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.user import User
from app.services.profiles_service import cast_profile_vote, get_public_profile, get_trending_profiles
from app.services.social_service import get_follow_status, toggle_follow

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("/trending")
async def trending(
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    return await get_trending_profiles(db, limit=limit)


@router.get("/{username}")
async def public_profile(
    username: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    try:
        viewer_id = uuid.UUID(get_current_user_id(request))
    except Exception:
        viewer_id = None
    profile = await get_public_profile(db, username, viewer_id=viewer_id)
    if viewer_id:
        follow_status = await get_follow_status(db, viewer_id, username)
        profile.update(follow_status)
    return profile


@router.post("/{username}/vote")
async def vote(
    username: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    body = await request.json()
    vote_type = body.get("vote_type", "hot")
    voter_id = uuid.UUID(get_current_user_id(request))
    return await cast_profile_vote(db, voter_id, username, vote_type)


@router.post("/{username}/follow")
async def follow(
    username: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    follower_id = uuid.UUID(get_current_user_id(request))
    return await toggle_follow(db, follower_id, username)


@router.get("/{username}/followers")
async def get_followers(username: str, db: AsyncSession = Depends(get_db)):
    from app.models.social import Follow
    target_result = await db.execute(select(User).where(User.username == username.lower()))
    target = target_result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    result = await db.execute(
        select(User).join(Follow, Follow.follower_id == User.id).where(Follow.following_id == target.id).limit(100)
    )
    users = result.scalars().all()
    return [
        {
            "username": u.username,
            "display_name": u.display_name,
            "avatar_url": u.avatar_url,
            "follower_count": u.follower_count,
        }
        for u in users
    ]


@router.get("/{username}/following")
async def get_following(username: str, db: AsyncSession = Depends(get_db)):
    from app.models.social import Follow
    source_result = await db.execute(select(User).where(User.username == username.lower()))
    source = source_result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="User not found")
    result = await db.execute(
        select(User).join(Follow, Follow.following_id == User.id).where(Follow.follower_id == source.id).limit(100)
    )
    users = result.scalars().all()
    return [
        {
            "username": u.username,
            "display_name": u.display_name,
            "avatar_url": u.avatar_url,
            "follower_count": u.follower_count,
        }
        for u in users
    ]
