"""Tracking and analytics API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.schemas.tracking import (
    TrackingEventLogRequest,
    UserBehaviorProfileResponse,
    UserInterestResponse,
    TrackingConsentRequest,
    TrackingConsentResponse,
)
from app.services.tracking_service import (
    log_event,
    get_user_behavior_profile,
    create_or_update_behavior_profile,
    derive_user_interests,
    get_user_interests,
    set_tracking_consent,
)
from app.models.tracking import TrackingEventType


router = APIRouter(prefix="/tracking", tags=["tracking"])


@router.post("/events", status_code=status.HTTP_201_CREATED)
async def log_tracking_event(
    data: TrackingEventLogRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Log a user tracking event."""
    try:
        user_id = uuid.UUID(get_current_user_id(request))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )
    
    try:
        event_type = TrackingEventType[data.event_type.upper()]
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid event type: {data.event_type}",
        )
    
    event = await log_event(
        db,
        user_id=user_id,
        event_type=event_type,
        target_user_id=data.target_user_id,
        target_post_id=data.target_post_id,
        search_query=data.search_query,
        user_agent=data.user_agent,
        device_type=data.device_type,
        browser=data.browser,
        os=data.os,
        ip_address=data.ip_address,
        country=data.country,
        session_id=data.session_id,
        time_on_page=data.time_on_page,
        metadata=data.metadata,
    )
    
    return {
        "id": str(event.id),
        "message": "Event logged successfully",
    }


@router.get("/profile", response_model=UserBehaviorProfileResponse)
async def get_behavior_profile(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> UserBehaviorProfileResponse:
    """Get user's behavior profile with analytics."""
    try:
        user_id = uuid.UUID(get_current_user_id(request))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )
    
    profile = await get_user_behavior_profile(db, user_id)
    
    if not profile:
        # Create profile if it doesn't exist
        profile = await create_or_update_behavior_profile(db, user_id)
    
    return UserBehaviorProfileResponse.model_validate(profile)


@router.post("/profile/analyze", response_model=UserBehaviorProfileResponse)
async def analyze_behavior(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> UserBehaviorProfileResponse:
    """Analyze and update user behavior profile."""
    try:
        user_id = uuid.UUID(get_current_user_id(request))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )
    
    profile = await create_or_update_behavior_profile(db, user_id)
    return UserBehaviorProfileResponse.model_validate(profile)


@router.get("/interests", response_model=list[UserInterestResponse])
async def get_interests(
    limit: int = 10,
    request: Request = None,
    db: AsyncSession = Depends(get_db),
) -> list[UserInterestResponse]:
    """Get user's derived interests."""
    try:
        user_id = uuid.UUID(get_current_user_id(request))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )
    
    interests = await get_user_interests(db, user_id, limit=limit)
    return [UserInterestResponse.model_validate(i) for i in interests]


@router.post("/interests/derive", response_model=list[UserInterestResponse])
async def derive_interests(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> list[UserInterestResponse]:
    """Derive interests from user behavior."""
    try:
        user_id = uuid.UUID(get_current_user_id(request))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )
    
    interests = await derive_user_interests(db, user_id)
    return [UserInterestResponse.model_validate(i) for i in interests]


@router.get("/consent", response_model=TrackingConsentResponse)
async def get_tracking_consent(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> TrackingConsentResponse:
    """Get user's tracking consent settings."""
    try:
        user_id = uuid.UUID(get_current_user_id(request))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )
    
    consent = await set_tracking_consent(db, user_id)
    return TrackingConsentResponse.model_validate(consent)


@router.post("/consent", response_model=TrackingConsentResponse)
async def update_tracking_consent(
    data: TrackingConsentRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> TrackingConsentResponse:
    """Update user's tracking consent settings."""
    try:
        user_id = uuid.UUID(get_current_user_id(request))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )
    
    consent = await set_tracking_consent(
        db,
        user_id,
        behavior_tracking=data.behavior_tracking_enabled,
        analytics=data.analytics_enabled,
        personalization=data.personalization_enabled,
    )
    
    return TrackingConsentResponse.model_validate(consent)
