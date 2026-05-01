"""Hot profiles scoring service with AI-based ranking.

Scoring Formula (4-component model):
  Hot Score = 0.35×B + 0.25×E + 0.20×V + 0.20×Q

Where:
  B = Beauty Score (0-100) — AI analysis of profile photos
  E = Engagement Power (0-100) — social interaction metrics
  V = Velocity (0-100) — growth momentum
  Q = Quality Score (0-100) — profile completeness & content quality
"""

import math
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.economy import EngagementEvent, EngagementEventType
from app.models.social import Follow, Post
from app.models.user import User


async def calculate_hot_score(db: AsyncSession, user_id: uuid.UUID) -> float:
    """Calculate hot score for a single user.

    Args:
        db: AsyncSession
        user_id: UUID of user to score

    Returns:
        Hot score (0-100)
    """
    result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .options(
            selectinload(User.beauty_scores),
            selectinload(User.engagement_events),
            selectinload(User.followers),
            selectinload(User.posts),
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        return 0.0

    # B: Beauty Score (0-100)
    beauty_score = 0.0
    if user.beauty_scores:
        # Use latest beauty score
        latest = max(user.beauty_scores, key=lambda x: x.created_at)
        beauty_score = latest.overall_score or 50.0
    else:
        # Default to 50 if no score yet
        beauty_score = 50.0

    # E: Engagement Power (0-100)
    # Formula: min((likes_7d + comments_7d×2 + posts_7d×3) / 100, 100)
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    # Count engagement events
    engagement_events = [
        e for e in user.engagement_events
        if e.created_at >= seven_days_ago
    ]
    engagement_points = sum(e.points for e in engagement_events)
    engagement_score = min((engagement_points / 100.0) * 100, 100.0)

    # V: Velocity (0-100)
    # Formula: growth momentum based on recent hot votes vs not votes
    # Using follower gain as proxy for momentum
    follower_count = user.follower_count or 0
    # Assume 5% follower gain in 7 days as "normal" — max out at 50% gain
    typical_gain = follower_count * 0.05
    actual_gain = max(0, follower_count - 100)  # baseline of 100 followers
    velocity_score = min((actual_gain / max(typical_gain, 1)) * 100, 100.0)

    # Q: Quality Score (0-100)
    # Components:
    #   - Bio filled: 20 points
    #   - Avatar set: 20 points
    #   - Has 10+ posts: 20 points
    #   - Follower ratio: 20 points
    #   - Profile completeness: 20 points
    quality_score = 0.0

    # Bio: 20 points
    if user.bio and len(user.bio) > 10:
        quality_score += 20.0

    # Avatar: 20 points
    if user.avatar_url:
        quality_score += 20.0

    # Posts (10+): 20 points
    post_count = len(user.posts) if user.posts else 0
    if post_count >= 10:
        quality_score += 20.0
    else:
        quality_score += (post_count / 10.0) * 20.0

    # Follower ratio: 20 points (max at 1000 followers)
    follower_ratio = min(follower_count / 1000.0, 1.0)
    quality_score += follower_ratio * 20.0

    # Profile completeness: 20 points
    completeness = 0
    if user.display_name and len(user.display_name) > 0:
        completeness += 1
    if user.bio:
        completeness += 1
    if user.avatar_url:
        completeness += 1
    if user.is_verified:
        completeness += 1
    quality_score += (completeness / 4.0) * 20.0

    # Final hot score: weighted formula
    hot_score = (
        0.35 * beauty_score +
        0.25 * engagement_score +
        0.20 * velocity_score +
        0.20 * quality_score
    )

    return min(max(hot_score, 0.0), 100.0)


async def calculate_all_hot_scores(db: AsyncSession) -> dict[str, int]:
    """Recalculate hot scores for all active users.

    Returns:
        Dict with counts: {"updated": N, "failed": M}
    """
    # Get all active users
    result = await db.execute(
        select(User.id).where(User.is_active == True)
    )
    user_ids = [row[0] for row in result.all()]

    updated = 0
    failed = 0

    for user_id in user_ids:
        try:
            score = await calculate_hot_score(db, user_id)

            # Update user's hot_score_cached
            await db.execute(
                update(User)
                .where(User.id == user_id)
                .values(
                    hot_score_cached=score,
                    hot_score_updated_at=datetime.now(timezone.utc),
                )
            )
            updated += 1
        except Exception as e:
            print(f"Error calculating hot score for user {user_id}: {e}")
            failed += 1

    # Update rankings
    result = await db.execute(
        select(User.id)
        .where(User.is_active == True)
        .order_by(User.hot_score_cached.desc())
    )
    ranked_ids = [row[0] for row in result.all()]

    for rank, user_id in enumerate(ranked_ids, 1):
        await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(hot_rank_position=rank)
        )

    await db.commit()
    return {"updated": updated, "failed": failed}


async def get_hot_profiles(
    db: AsyncSession,
    limit: int = 20,
    offset: int = 0,
) -> list[dict]:
    """Get top hot profiles.

    Args:
        db: AsyncSession
        limit: Number of results (max 100)
        offset: Pagination offset

    Returns:
        List of user dicts with hot score breakdown
    """
    if limit > 100:
        limit = 100

    result = await db.execute(
        select(User)
        .where(User.is_active == True)
        .order_by(User.hot_score_cached.desc())
        .offset(offset)
        .limit(limit)
        .options(selectinload(User.beauty_scores))
    )
    users = result.scalars().all()

    profiles = []
    for user in users:
        # Get latest beauty score
        beauty_score = 0.0
        if user.beauty_scores:
            latest = max(user.beauty_scores, key=lambda x: x.created_at)
            beauty_score = latest.overall_score or 50.0

        profile_dict = {
            "id": str(user.id),
            "username": user.username,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
            "bio": user.bio,
            "follower_count": user.follower_count,
            "hot_score": user.hot_score_cached,
            "hot_rank_position": user.hot_rank_position,
            "beauty_score": beauty_score,
            "engagement_level": "high" if user.hot_score_cached >= 75 else "medium" if user.hot_score_cached >= 50 else "low",
        }
        profiles.append(profile_dict)

    return profiles


async def get_hot_score_breakdown(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> dict:
    """Get detailed hot score breakdown for a user.

    Returns:
        Dict with: hot_score, beauty_score, engagement_score, velocity_score, quality_score
    """
    result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .options(
            selectinload(User.beauty_scores),
            selectinload(User.engagement_events),
            selectinload(User.followers),
            selectinload(User.posts),
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        return {}

    # Recalculate components
    beauty_score = 0.0
    if user.beauty_scores:
        latest = max(user.beauty_scores, key=lambda x: x.created_at)
        beauty_score = latest.overall_score or 50.0

    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    engagement_events = [
        e for e in user.engagement_events
        if e.created_at >= seven_days_ago
    ]
    engagement_points = sum(e.points for e in engagement_events)
    engagement_score = min((engagement_points / 100.0) * 100, 100.0)

    follower_count = user.follower_count or 0
    typical_gain = follower_count * 0.05
    actual_gain = max(0, follower_count - 100)
    velocity_score = min((actual_gain / max(typical_gain, 1)) * 100, 100.0)

    quality_score = 0.0
    if user.bio and len(user.bio) > 10:
        quality_score += 20.0
    if user.avatar_url:
        quality_score += 20.0
    post_count = len(user.posts) if user.posts else 0
    if post_count >= 10:
        quality_score += 20.0
    else:
        quality_score += (post_count / 10.0) * 20.0
    follower_ratio = min(follower_count / 1000.0, 1.0)
    quality_score += follower_ratio * 20.0
    completeness = 0
    if user.display_name:
        completeness += 1
    if user.bio:
        completeness += 1
    if user.avatar_url:
        completeness += 1
    if user.is_verified:
        completeness += 1
    quality_score += (completeness / 4.0) * 20.0

    hot_score = (
        0.35 * beauty_score +
        0.25 * engagement_score +
        0.20 * velocity_score +
        0.20 * quality_score
    )

    return {
        "hot_score": min(max(hot_score, 0.0), 100.0),
        "beauty_score": beauty_score,
        "engagement_score": engagement_score,
        "velocity_score": velocity_score,
        "quality_score": quality_score,
        "components": {
            "beauty": {"weight": 0.35, "score": beauty_score},
            "engagement": {"weight": 0.25, "score": engagement_score},
            "velocity": {"weight": 0.20, "score": velocity_score},
            "quality": {"weight": 0.20, "score": quality_score},
        },
    }
