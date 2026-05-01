"""
User rating and profile impression service.

Tracks 1-10 ratings between users and profile view impressions.
Maintains denormalized rating aggregates on the User model.
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rating import ProfileImpression, UserRating
from app.models.user import User


async def rate_user(
    db: AsyncSession,
    rater_id: uuid.UUID,
    rated_user_id: uuid.UUID,
    score: int,
    note: str | None = None,
) -> UserRating:
    """Create or update a rating from rater_id to rated_user_id (1-10 scale).
    
    Recalculates the target user's rating_score and rating_count.
    """
    if rater_id == rated_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot rate yourself",
        )
    
    if not (1 <= score <= 10):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Score must be between 1 and 10",
        )
    
    # Check if target user exists
    target = await db.execute(select(User).where(User.id == rated_user_id))
    if not target.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create or update rating
    existing = await db.execute(
        select(UserRating).where(
            (UserRating.rater_id == rater_id) & (UserRating.rated_user_id == rated_user_id)
        )
    )
    rating = existing.scalar_one_or_none()
    
    if rating:
        rating.impression_score = score
        rating.note = note
        rating.created_at = datetime.now(timezone.utc)
    else:
        rating = UserRating(
            rater_id=rater_id,
            rated_user_id=rated_user_id,
            impression_score=score,
            note=note,
            created_at=datetime.now(timezone.utc),
        )
        db.add(rating)
    
    await db.flush()
    
    # Recalculate target user's rating aggregates
    await calculate_user_rating_aggregates(db, rated_user_id)
    
    await db.commit()
    await db.refresh(rating)
    return rating


async def get_user_rating(db: AsyncSession, user_id: uuid.UUID) -> dict:
    """Get rating aggregates for a user: rating_score, rating_count, average."""
    result = await db.execute(
        select(
            func.count(UserRating.id).label("count"),
            func.avg(UserRating.impression_score).label("avg"),
        ).where(UserRating.rated_user_id == user_id)
    )
    row = result.one()
    count = row.count or 0
    avg = float(row.avg) if row.avg else 0.0
    
    # Get user's denormalized fields (if exists)
    user_result = await db.execute(
        select(User.rating_score, User.rating_count).where(User.id == user_id)
    )
    user_row = user_result.scalar_one_or_none()
    
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "user_id": str(user_id),
        "rating_score": user_row.rating_score or 0.0,
        "rating_count": user_row.rating_count or 0,
        "average": avg,
        "total_ratings": count,
    }


async def get_recent_ratings(
    db: AsyncSession, user_id: uuid.UUID, days: int = 7
) -> list[dict]:
    """Get ratings for a user from the last N days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    
    result = await db.execute(
        select(UserRating)
        .where(
            (UserRating.rated_user_id == user_id) & (UserRating.created_at >= cutoff)
        )
        .order_by(UserRating.created_at.desc())
    )
    ratings = result.scalars().all()
    
    return [
        {
            "id": str(r.id),
            "rater_id": str(r.rater_id),
            "score": r.impression_score,
            "note": r.note,
            "created_at": r.created_at.isoformat(),
        }
        for r in ratings
    ]


async def record_profile_view(
    db: AsyncSession, visitor_id: uuid.UUID, target_user_id: uuid.UUID
) -> ProfileImpression:
    """Record a profile view impression."""
    if visitor_id == target_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot view your own profile",
        )
    
    impression = ProfileImpression(
        visitor_id=visitor_id,
        target_user_id=target_user_id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(impression)
    await db.commit()
    await db.refresh(impression)
    return impression


async def get_impression_count(
    db: AsyncSession, user_id: uuid.UUID, hours: int = 24
) -> int:
    """Count profile views for a user in the last N hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    
    result = await db.execute(
        select(func.count(ProfileImpression.id)).where(
            (ProfileImpression.target_user_id == user_id)
            & (ProfileImpression.created_at >= cutoff)
        )
    )
    return result.scalar() or 0


async def calculate_user_rating_aggregates(
    db: AsyncSession, user_id: uuid.UUID | None = None
) -> None:
    """Recalculate all (or single user's) denormalized rating_score and rating_count.
    
    Called by scheduled job or after each rating update.
    """
    if user_id:
        # Single user
        result = await db.execute(
            select(
                func.count(UserRating.id).label("count"),
                func.avg(UserRating.impression_score).label("avg"),
            ).where(UserRating.rated_user_id == user_id)
        )
        row = result.one()
        count = row.count or 0
        avg = float(row.avg) if row.avg else 0.0
        
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if user:
            user.rating_count = count
            user.rating_score = avg
        
        await db.commit()
    else:
        # All users
        result = await db.execute(
            select(
                UserRating.rated_user_id,
                func.count(UserRating.id).label("count"),
                func.avg(UserRating.impression_score).label("avg"),
            ).group_by(UserRating.rated_user_id)
        )
        rows = result.all()
        
        for row in rows:
            user_result = await db.execute(
                select(User).where(User.id == row.rated_user_id)
            )
            user = user_result.scalar_one_or_none()
            if user:
                user.rating_count = row.count or 0
                user.rating_score = float(row.avg) if row.avg else 0.0
        
        await db.commit()
