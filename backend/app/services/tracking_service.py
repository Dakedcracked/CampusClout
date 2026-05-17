"""User behavior tracking and analytics service."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tracking import (
    UserTrackingEvent,
    TrackingEventType,
    UserBehaviorProfile,
    UserInterest,
)
from app.models.otp import TrackingConsent


async def log_event(
    db: AsyncSession,
    user_id: uuid.UUID,
    event_type: TrackingEventType,
    target_user_id: Optional[uuid.UUID] = None,
    target_post_id: Optional[uuid.UUID] = None,
    search_query: Optional[str] = None,
    user_agent: Optional[str] = None,
    device_type: Optional[str] = None,
    browser: Optional[str] = None,
    os: Optional[str] = None,
    ip_address: Optional[str] = None,
    country: Optional[str] = None,
    session_id: Optional[str] = None,
    time_on_page: Optional[int] = None,
    metadata: Optional[dict] = None,
) -> UserTrackingEvent:
    """Log a user behavior event."""

    # Check user's tracking consent
    consent_result = await db.execute(
        select(TrackingConsent).where(
            and_(
                TrackingConsent.user_id == user_id,
                TrackingConsent.behavior_tracking_enabled == True,
            )
        )
    )
    
    if not consent_result.scalars().first():
        # User hasn't consented to tracking, still log anonymously
        user_id = None

    event = UserTrackingEvent(
        user_id=user_id,
        event_type=event_type,
        target_user_id=target_user_id,
        target_post_id=target_post_id,
        search_query=search_query,
        user_agent=user_agent,
        device_type=device_type,
        browser=browser,
        os=os,
        ip_address=ip_address,
        country=country,
        session_id=session_id,
        time_on_page=time_on_page,
        event_data=metadata or {},
    )

    db.add(event)
    await db.commit()
    return event


async def get_user_behavior_profile(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> UserBehaviorProfile | None:
    """Get user's behavior profile."""
    result = await db.execute(
        select(UserBehaviorProfile).where(UserBehaviorProfile.user_id == user_id)
    )
    return result.scalars().first()


async def create_or_update_behavior_profile(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> UserBehaviorProfile:
    """Create or update user behavior profile with analytics."""

    # Get or create profile
    result = await db.execute(
        select(UserBehaviorProfile).where(UserBehaviorProfile.user_id == user_id)
    )
    profile = result.scalars().first()

    if not profile:
        profile = UserBehaviorProfile(user_id=user_id)
        db.add(profile)
        await db.flush()

    # Get event stats for last 30 days
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

    events_result = await db.execute(
        select(UserTrackingEvent).where(
            and_(
                UserTrackingEvent.user_id == user_id,
                UserTrackingEvent.created_at >= thirty_days_ago,
            )
        )
    )
    events = events_result.scalars().all()

    if not events:
        profile.engagement_score = 0.0
        profile.activity_score = 0.0
        profile.social_score = 0.0
        profile.total_events = 0
        profile.analyzed_at = datetime.now(timezone.utc)
        await db.commit()
        return profile

    # Calculate engagement scores
    event_counts = {}
    for event in events:
        event_type = event.event_type.value
        event_counts[event_type] = event_counts.get(event_type, 0) + 1

    # Scoring weights
    weights = {
        "PAGE_VIEW": 1,
        "PROFILE_VIEW": 2,
        "POST_VIEW": 2,
        "POST_LIKE": 5,
        "COMMENT_CREATE": 10,
        "SEARCH": 2,
        "FOLLOW": 8,
        "STORE_PURCHASE": 15,
        "RATE_PROFILE": 5,
    }

    # Calculate engagement score (0-100)
    total_score = sum(
        count * weights.get(event_type, 1)
        for event_type, count in event_counts.items()
    )
    engagement_score = min(100, (total_score / 50))  # Normalize to 0-100

    # Calculate activity score (frequency)
    unique_days = len(
        set(event.created_at.date() for event in events)
    )
    activity_score = min(100, (unique_days / 30) * 100)

    # Calculate social score
    social_events = sum(
        event_counts.get(et, 0)
        for et in ["FOLLOW", "COMMENT_CREATE", "RATE_PROFILE"]
    )
    social_score = min(100, (social_events / 20) * 100)

    # Device diversity
    devices = set(e.device_type for e in events if e.device_type)
    device_diversity = len(devices) / 3  # Max 3 device types

    # Primary device
    device_counts = {}
    for event in events:
        if event.device_type:
            device_counts[event.device_type] = (
                device_counts.get(event.device_type, 0) + 1
            )
    primary_device = max(device_counts, key=device_counts.get) if device_counts else None

    # Peak activity hour
    hour_counts = {}
    for event in events:
        hour = event.created_at.hour
        hour_counts[hour] = hour_counts.get(hour, 0) + 1
    peak_hour = max(hour_counts, key=hour_counts.get) if hour_counts else None

    # Primary country
    country_counts = {}
    for event in events:
        if event.country:
            country_counts[event.country] = (
                country_counts.get(event.country, 0) + 1
            )
    primary_country = (
        max(country_counts, key=country_counts.get) if country_counts else None
    )
    countries_count = len(country_counts)

    # Calculate average session duration
    session_durations = [e.time_on_page for e in events if e.time_on_page]
    avg_session_duration = (
        sum(session_durations) / len(session_durations) / 60
        if session_durations
        else 0
    )

    # Update profile
    profile.engagement_score = engagement_score
    profile.activity_score = activity_score
    profile.social_score = social_score
    profile.discovery_score = min(100, (event_counts.get("SEARCH", 0) / 10) * 100)
    profile.total_events = len(events)
    profile.unique_days_active = unique_days
    profile.avg_session_duration = avg_session_duration
    profile.peak_activity_hour = peak_hour
    profile.primary_device = primary_device
    profile.device_diversity = device_diversity
    profile.primary_country = primary_country
    profile.countries_count = countries_count
    profile.analyzed_at = datetime.now(timezone.utc)

    await db.commit()
    return profile


async def derive_user_interests(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> list[UserInterest]:
    """Derive user interests from behavior patterns."""

    # Clear old interests
    await db.execute(
        select(UserInterest).where(UserInterest.user_id == user_id)
    )

    # Get events from last 60 days
    sixty_days_ago = datetime.now(timezone.utc) - timedelta(days=60)
    events_result = await db.execute(
        select(UserTrackingEvent).where(
            and_(
                UserTrackingEvent.user_id == user_id,
                UserTrackingEvent.created_at >= sixty_days_ago,
            )
        )
    )
    events = events_result.scalars().all()

    interests = []
    
    # Derive interests from metadata (e.g., search queries, categories)
    for event in events:
        if event.event_data and "interest" in event.event_data:
            interest_tag = event.event_data["interest"]
            
            # Find or create interest
            interest_result = await db.execute(
                select(UserInterest).where(
                    and_(
                        UserInterest.user_id == user_id,
                        UserInterest.interest_tag == interest_tag,
                    )
                )
            )
            interest = interest_result.scalars().first()

            if interest:
                interest.frequency += 1
                interest.last_detected_at = datetime.now(timezone.utc)
                interest.confidence_score = min(
                    1.0, interest.frequency / 100
                )
            else:
                interest = UserInterest(
                    user_id=user_id,
                    interest_tag=interest_tag,
                    frequency=1,
                    confidence_score=0.1,
                    last_detected_at=datetime.now(timezone.utc),
                )
                db.add(interest)

            interests.append(interest)

    # Derive interests from search queries
    search_events = [e for e in events if e.event_type == TrackingEventType.SEARCH]
    for event in search_events:
        if event.search_query:
            query_tags = event.search_query.lower().split()
            for tag in query_tags:
                if len(tag) > 2:
                    interest_result = await db.execute(
                        select(UserInterest).where(
                            and_(
                                UserInterest.user_id == user_id,
                                UserInterest.interest_tag == tag,
                            )
                        )
                    )
                    interest = interest_result.scalars().first()

                    if interest:
                        interest.frequency += 1
                        interest.confidence_score = min(
                            1.0, interest.frequency / 50
                        )
                    else:
                        interest = UserInterest(
                            user_id=user_id,
                            interest_tag=tag,
                            frequency=1,
                            confidence_score=0.2,
                            last_detected_at=datetime.now(timezone.utc),
                        )
                        db.add(interest)

                    interests.append(interest)

    await db.commit()
    return interests


async def get_user_interests(
    db: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 10,
) -> list[UserInterest]:
    """Get user's top interests."""
    result = await db.execute(
        select(UserInterest)
        .where(UserInterest.user_id == user_id)
        .order_by(UserInterest.confidence_score.desc())
        .limit(limit)
    )
    return result.scalars().all()


async def set_tracking_consent(
    db: AsyncSession,
    user_id: uuid.UUID,
    behavior_tracking: bool = True,
    analytics: bool = True,
    personalization: bool = True,
) -> TrackingConsent:
    """Set or update user tracking consent."""

    result = await db.execute(
        select(TrackingConsent).where(TrackingConsent.user_id == user_id)
    )
    consent = result.scalars().first()

    if consent:
        consent.behavior_tracking_enabled = behavior_tracking
        consent.analytics_enabled = analytics
        consent.personalization_enabled = personalization
        consent.consented_at = datetime.now(timezone.utc)
    else:
        consent = TrackingConsent(
            user_id=user_id,
            behavior_tracking_enabled=behavior_tracking,
            analytics_enabled=analytics,
            personalization_enabled=personalization,
            consented_at=datetime.now(timezone.utc),
        )
        db.add(consent)

    await db.commit()
    return consent
