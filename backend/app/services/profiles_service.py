"""
Profiles & Trending service.

Profile: public view with stats, posts, market cap, beauty score, vote counts.
Trending: ranked by balanced formula:
  - 35% from votes (hot - not × 0.5)
  - 35% from AI beauty score
  - 15% from market cap
  - 15% from engagement (7-day activity)
Voting: one hot/not vote per user per target; awards beauty coins on hot votes.
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.economy import CloutBalance, EngagementEvent
from app.models.social import Post, ProfileVote
from app.models.user import User

HOT_BEAUTY_COIN_REWARD = 5
HOT_TOKEN_BOOST = 2


def _calculate_balanced_trending_score(
    hot_count: int,
    not_count: int,
    beauty_score: float | None,
    market_cap: float,
    engagement_7d: int,
) -> float:
    """
    Calculate trending score using balanced percentage-based formula:
      - 35% from votes: (hot_count / (hot_count + not_count + 1)) * 100
      - 35% from AI beauty score: 0-100 (already normalized)
      - 15% from market cap: (market_cap / 10000) * 100 (capped at 100%)
      - 15% from engagement: (engagement_7d / 100) * 100 (capped at 100%)

    All components are percentages (0-100), then weighted.
    Result: 0-100 percentage score for easier interpretation and display.
    """
    # Vote component: calculate attractiveness percentage
    # Formula: hot votes / (hot + not + 1) to avoid division by zero
    total_votes = hot_count + not_count + 1
    vote_percentage = (hot_count / total_votes) * 100

    # Beauty component: already 0-100
    beauty_percentage = beauty_score if beauty_score else 50.0  # default to 50% if no beauty score

    # Market cap component: percentage with 10k cap
    market_cap_percentage = min(100.0, (market_cap / 10000.0) * 100)

    # Engagement component: percentage with 100 points cap
    engagement_percentage = min(100.0, (engagement_7d / 100.0) * 100)

    # Weighted formula (all components already 0-100)
    trending_score = (
        (vote_percentage * 0.35) +
        (beauty_percentage * 0.35) +
        (market_cap_percentage * 0.15) +
        (engagement_percentage * 0.15)
    )

    return round(trending_score, 2)


async def get_public_profile(db: AsyncSession, username: str, viewer_id: uuid.UUID | None = None) -> dict:
    result = await db.execute(
        select(User, CloutBalance)
        .join(CloutBalance, CloutBalance.user_id == User.id, isouter=True)
        .where(User.username == username.lower(), User.is_active == True)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    user, balance = row

    # Recent posts
    posts_result = await db.execute(
        select(Post)
        .where(Post.author_id == user.id, Post.is_alter_ego_post == False)
        .order_by(Post.created_at.desc())
        .limit(10)
    )
    posts = posts_result.scalars().all()

    # Latest beauty score
    from app.models.beauty import BeautyScore
    bs_result = await db.execute(
        select(BeautyScore)
        .where(BeautyScore.user_id == user.id)
        .order_by(BeautyScore.created_at.desc())
        .limit(1)
    )
    beauty = bs_result.scalar_one_or_none()

    # Viewer's existing vote
    viewer_vote = None
    if viewer_id and viewer_id != user.id:
        vr = await db.execute(
            select(ProfileVote).where(
                ProfileVote.voter_id == viewer_id,
                ProfileVote.target_id == user.id,
            )
        )
        existing = vr.scalar_one_or_none()
        viewer_vote = existing.vote_type if existing else None

    return {
        "user_id": str(user.id),
        "username": user.username,
        "display_name": user.display_name,
        "bio": user.bio,
        "avatar_url": user.avatar_url,
        "university_domain": user.university_domain,
        "is_verified": user.is_verified,
        "market_cap": balance.market_cap if balance else 0.0,
        "wallet_balance": balance.wallet_balance if balance else 0,
        "tokens_invested_in_me": balance.tokens_invested_in_me if balance else 0,
        "beauty_coins": balance.beauty_coins if balance else 0,
        "hot_count": user.hot_count,
        "not_count": user.not_count,
        "vote_score": user.vote_score,
        "viewer_vote": viewer_vote,
        "beauty_score": beauty.overall_score if beauty else None,
        "posts": [
            {
                "id": str(p.id),
                "content": p.content,
                "like_count": p.like_count,
                "created_at": p.created_at.isoformat(),
            }
            for p in posts
        ],
        "joined": user.created_at.isoformat(),
    }


async def cast_profile_vote(
    db: AsyncSession, voter_id: uuid.UUID, target_username: str, vote_type: str
) -> dict:
    if vote_type not in ("hot", "not"):
        raise HTTPException(status_code=400, detail="vote_type must be 'hot' or 'not'")

    target_result = await db.execute(
        select(User, CloutBalance)
        .join(CloutBalance, CloutBalance.user_id == User.id, isouter=True)
        .where(User.username == target_username.lower())
    )
    row = target_result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    target, target_balance = row

    if target.id == voter_id:
        raise HTTPException(status_code=400, detail="Cannot vote on your own profile")

    # Check for existing vote (replace allowed — changes the direction)
    existing_result = await db.execute(
        select(ProfileVote).where(
            ProfileVote.voter_id == voter_id,
            ProfileVote.target_id == target.id,
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing:
        old_type = existing.vote_type
        if old_type == vote_type:
            raise HTTPException(status_code=409, detail="Already voted this way")
        # Reverse the old vote
        if old_type == "hot":
            target.hot_count = max(0, target.hot_count - 1)
        else:
            target.not_count = max(0, target.not_count - 1)
        existing.vote_type = vote_type
    else:
        vote = ProfileVote(voter_id=voter_id, target_id=target.id, vote_type=vote_type)
        db.add(vote)

    # Apply new vote
    if vote_type == "hot":
        target.hot_count += 1
        # Award beauty coins to target
        if target_balance:
            target_balance.beauty_coins += HOT_BEAUTY_COIN_REWARD
    else:
        target.not_count += 1

    # Recompute vote_score: Wilson-ish score = hot - not*0.5
    target.vote_score = float(target.hot_count - target.not_count * 0.5)

    await db.commit()
    return {
        "target": target.username,
        "vote_type": vote_type,
        "hot_count": target.hot_count,
        "not_count": target.not_count,
        "vote_score": target.vote_score,
        "beauty_coins_awarded": HOT_BEAUTY_COIN_REWARD if vote_type == "hot" else 0,
    }


async def get_trending_profiles(db: AsyncSession, limit: int = 20) -> list[dict]:
    """
    Get trending profiles ranked by balanced formula.

    Formula considers:
    - Vote score (35%)
    - AI beauty score (35%)
    - Market cap (15%)
    - 7-day engagement (15%)
    """
    # Calculate engagement score for each user (7-day window)
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    # Get users with their balances, beauty scores, and engagement
    result = await db.execute(
        select(
            User,
            CloutBalance,
            func.coalesce(
                func.sum(
                    func.coalesce(EngagementEvent.points, 1)
                ),
                0,
            ).label("engagement_7d"),
        )
        .join(CloutBalance, CloutBalance.user_id == User.id, isouter=True)
        .join(
            EngagementEvent,
            (EngagementEvent.user_id == User.id) & (EngagementEvent.created_at >= seven_days_ago),
            isouter=True,
        )
        .where(User.is_active == True)
        .group_by(User.id, CloutBalance.id)
    )
    rows = result.all()

    from app.models.beauty import BeautyScore

    profiles = []
    for rank, (user, balance, engagement_7d) in enumerate(rows, 1):
        # Get latest beauty score
        bs_r = await db.execute(
            select(BeautyScore.overall_score)
            .where(BeautyScore.user_id == user.id)
            .order_by(BeautyScore.created_at.desc())
            .limit(1)
        )
        beauty_score = bs_r.scalar_one_or_none()

        # Calculate trending score using balanced formula
        trending_score = _calculate_balanced_trending_score(
            hot_count=user.hot_count,
            not_count=user.not_count,
            beauty_score=beauty_score,
            market_cap=balance.market_cap if balance else 0.0,
            engagement_7d=int(engagement_7d),
        )

        profiles.append({
            "rank": rank,
            "user_id": str(user.id),
            "username": user.username,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
            "market_cap": balance.market_cap if balance else 0.0,
            "beauty_coins": balance.beauty_coins if balance else 0,
            "hot_count": user.hot_count,
            "not_count": user.not_count,
            "vote_score": user.vote_score,
            "beauty_score": beauty_score,
            "engagement_7d": int(engagement_7d),
            "trending_score": trending_score,
            "trending_breakdown": {
                "votes": round((user.hot_count - (user.not_count * 0.5)) / max(user.hot_count + user.not_count, 1) * 35, 1) if (user.hot_count + user.not_count) > 0 else 0,
                "beauty": round((beauty_score / 100 * 35) if beauty_score else 0, 1),
                "market_cap": round(min(1.0, (balance.market_cap if balance else 0) / 10000) * 15, 1),
                "engagement": round(min(1.0, engagement_7d / 100) * 15, 1),
            },
        })

    # Sort by trending_score descending
    profiles.sort(key=lambda p: p["trending_score"], reverse=True)

    # Update ranks after sorting
    for i, p in enumerate(profiles, 1):
        p["rank"] = i

    return profiles[:limit]
