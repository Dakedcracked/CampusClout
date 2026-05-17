"""Schemas for user tracking and analytics."""

import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class TrackingEventLogRequest(BaseModel):
    """Log a user tracking event."""
    event_type: str
    target_user_id: Optional[uuid.UUID] = None
    target_post_id: Optional[uuid.UUID] = None
    search_query: Optional[str] = None
    user_agent: Optional[str] = None
    device_type: Optional[str] = None
    browser: Optional[str] = None
    os: Optional[str] = None
    ip_address: Optional[str] = None
    country: Optional[str] = None
    session_id: Optional[str] = None
    time_on_page: Optional[int] = None
    metadata: Optional[dict] = None


class UserBehaviorProfileResponse(BaseModel):
    """User behavior profile response."""
    model_config = {"from_attributes": True}

    id: uuid.UUID
    user_id: uuid.UUID
    engagement_score: float
    activity_score: float
    social_score: float
    discovery_score: float
    total_events: int
    unique_days_active: int
    avg_session_duration: float
    peak_activity_hour: Optional[int]
    top_interests: list[str]
    primary_device: Optional[str]
    device_diversity: float
    primary_country: Optional[str]
    countries_count: int
    analyzed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class UserInterestResponse(BaseModel):
    """User interest response."""
    model_config = {"from_attributes": True}

    id: uuid.UUID
    user_id: uuid.UUID
    interest_tag: str
    confidence_score: float
    frequency: int
    last_detected_at: datetime


class TrackingConsentRequest(BaseModel):
    """Set tracking consent."""
    behavior_tracking_enabled: bool = True
    analytics_enabled: bool = True
    personalization_enabled: bool = True


class TrackingConsentResponse(BaseModel):
    """Tracking consent response."""
    model_config = {"from_attributes": True}

    id: uuid.UUID
    user_id: uuid.UUID
    behavior_tracking_enabled: bool
    analytics_enabled: bool
    personalization_enabled: bool
    consent_version: str
    consented_at: datetime
    created_at: datetime
