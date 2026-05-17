import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.rating import ProfileImpression, UserRating
from app.models.user import User
from app.schemas.ratings import (
    RatingCreate,
    RatingResponse,
    RatingsGivenResponse,
    RatingsReceivedResponse,
    UserRatingPublicResponse,
    ViewRecordResponse,
)

router = APIRouter(prefix="/ratings", tags=["ratings"])


@router.post("", response_model=RatingResponse, status_code=status.HTTP_201_CREATED)
async def rate_user(
    data: RatingCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> RatingResponse:
    """Rate a user with a 1-10 score and optional note."""
    rater_id = uuid.UUID(get_current_user_id(request))

    if rater_id == data.rated_user_id:
        raise HTTPException(status_code=400, detail="Cannot rate yourself")

    # Check if rated user exists
    rated_result = await db.execute(select(User).where(User.id == data.rated_user_id))
    rated_user = rated_result.scalar_one_or_none()
    if not rated_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Create or update rating
    rating_result = await db.execute(
        select(UserRating).where(
            UserRating.rater_id == rater_id,
            UserRating.rated_user_id == data.rated_user_id,
        )
    )
    rating = rating_result.scalar_one_or_none()

    if rating:
        rating.impression_score = data.score
        rating.note = data.note
    else:
        from datetime import datetime

        rating = UserRating(
            rater_id=rater_id,
            rated_user_id=data.rated_user_id,
            impression_score=data.score,
            note=data.note,
            created_at=datetime.utcnow(),
        )
        db.add(rating)

    await db.commit()
    await db.refresh(rating)

    # Fetch rater info
    rater_result = await db.execute(select(User).where(User.id == rater_id))
    rater = rater_result.scalar_one()

    return RatingResponse(
        id=rating.id,
        rater_id=rating.rater_id,
        rater_username=rater.username,
        rater_avatar=rater.avatar_url,
        rated_user_id=rating.rated_user_id,
        impression_score=rating.impression_score,
        note=rating.note,
        created_at=rating.created_at,
    )


@router.get("/user/{username}", response_model=UserRatingPublicResponse)
async def get_user_rating(
    username: str,
    db: AsyncSession = Depends(get_db),
) -> UserRatingPublicResponse:
    """Get public rating info for a user."""
    user_result = await db.execute(select(User).where(User.username == username.lower()))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserRatingPublicResponse(
        rating_score=user.rating_score,
        rating_count=user.rating_count,
    )


@router.get("/me/given", response_model=RatingsGivenResponse)
async def my_ratings_given(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> RatingsGivenResponse:
    """List ratings I've given (paginated)."""
    rater_id = uuid.UUID(get_current_user_id(request))

    # Count total
    count_result = await db.execute(
        select(func.count(UserRating.id)).where(UserRating.rater_id == rater_id)
    )
    total = count_result.scalar() or 0

    # Fetch ratings with related users
    ratings_result = await db.execute(
        select(UserRating)
        .where(UserRating.rater_id == rater_id)
        .options(selectinload(UserRating.rated_user))
        .order_by(UserRating.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    ratings = ratings_result.scalars().all()

    # Fetch rater info
    rater_result = await db.execute(select(User).where(User.id == rater_id))
    rater = rater_result.scalar_one()

    return RatingsGivenResponse(
        ratings=[
            RatingResponse(
                id=r.id,
                rater_id=r.rater_id,
                rater_username=rater.username,
                rater_avatar=rater.avatar_url,
                rated_user_id=r.rated_user_id,
                impression_score=r.impression_score,
                note=r.note,
                created_at=r.created_at,
            )
            for r in ratings
        ],
        total=total,
    )


@router.get("/me/received", response_model=RatingsReceivedResponse)
async def my_ratings_received(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> RatingsReceivedResponse:
    """List ratings about me."""
    rated_user_id = uuid.UUID(get_current_user_id(request))

    # Count total
    count_result = await db.execute(
        select(func.count(UserRating.id)).where(UserRating.rated_user_id == rated_user_id)
    )
    total = count_result.scalar() or 0

    # Fetch ratings with related raters
    ratings_result = await db.execute(
        select(UserRating)
        .where(UserRating.rated_user_id == rated_user_id)
        .options(selectinload(UserRating.rater))
        .order_by(UserRating.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    ratings = ratings_result.scalars().all()

    return RatingsReceivedResponse(
        ratings=[
            RatingResponse(
                id=r.id,
                rater_id=r.rater_id,
                rater_username=r.rater.username,
                rater_avatar=r.rater.avatar_url,
                rated_user_id=r.rated_user_id,
                impression_score=r.impression_score,
                note=r.note,
                created_at=r.created_at,
            )
            for r in ratings
        ],
        total=total,
    )


@router.post("/record-view/{username}", response_model=ViewRecordResponse, status_code=status.HTTP_201_CREATED)
async def record_profile_view(
    username: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> ViewRecordResponse:
    """Record that I viewed their profile."""
    visitor_id = uuid.UUID(get_current_user_id(request))

    # Find target user
    target_result = await db.execute(select(User).where(User.username == username.lower()))
    target = target_result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if visitor_id == target.id:
        raise HTTPException(status_code=400, detail="Cannot record view on yourself")

    # Record impression
    from datetime import datetime

    impression = ProfileImpression(
        visitor_id=visitor_id,
        target_user_id=target.id,
        created_at=datetime.utcnow(),
    )
    db.add(impression)
    await db.commit()

    return ViewRecordResponse()
