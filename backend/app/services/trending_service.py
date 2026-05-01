"""Trending profiles scoring engine and leaderboards."""

import uuid
from datetime import datetime, timedelta
from sqlalchemy import select, desc, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.trending import ProfileTrendingScore, WalletPoints, PointTransaction
from app.models.social import Post, PostLike, ProfileVote


class TrendingService:
    """Calculate and manage trending profiles."""

    @staticmethod
    async def calculate_market_cap_component(db: AsyncSession, user_id: uuid.UUID) -> float:
        """Market cap normalized to 0-100 scale."""
        user_result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()
        if not user or not user.market_cap:
            return 0.0

        # Normalize: 100 tokens = 0, 100,000 tokens = 100
        normalized = min(100.0, max(0.0, (user.market_cap - 100) / 999))
        return normalized

    @staticmethod
    async def calculate_hot_ratio_component(db: AsyncSession, user_id: uuid.UUID) -> float:
        """Hot votes / (hot + not votes). Minimum 50 votes required."""
        hot_result = await db.execute(
            select(func.count(ProfileVote.id)).where(
                and_(ProfileVote.target_user_id == user_id, ProfileVote.vote_type == "hot")
            )
        )
        hot_count = hot_result.scalar() or 0

        not_result = await db.execute(
            select(func.count(ProfileVote.id)).where(
                and_(ProfileVote.target_user_id == user_id, ProfileVote.vote_type == "not")
            )
        )
        not_count = not_result.scalar() or 0

        total_votes = hot_count + not_count
        if total_votes < 50:
            return 0.0  # Minimum 50 votes required

        return float(hot_count) / total_votes

    @staticmethod
    async def calculate_content_power_component(db: AsyncSession, user_id: uuid.UUID) -> float:
        """Engagement on posts in last 7 days + activity frequency."""
        seven_days_ago = datetime.utcnow() - timedelta(days=7)

        # Get posts from last 7 days
        posts_result = await db.execute(
            select(Post).where(
                and_(Post.author_id == user_id, Post.created_at >= seven_days_ago)
            )
        )
        posts = posts_result.scalars().all()

        if not posts:
            return 0.0

        # Count engagement
        likes_result = await db.execute(
            select(func.count(PostLike.id)).where(
                PostLike.post_id.in_([p.id for p in posts])
            )
        )
        likes = likes_result.scalar() or 0

        # Comments/shares would need new tables; using likes as proxy
        total_engagement = likes

        # Calculate component: engagement + post frequency + media ratio
        # Rough formula: (engagement/100) + (post_count/10) * media_ratio
        content_score = min(100.0, (total_engagement / 100.0) + (len(posts) / 10.0) * 0.5)
        return content_score

    @staticmethod
    async def calculate_engagement_velocity_component(db: AsyncSession, user_id: uuid.UUID) -> float:
        """7-day engagement velocity compared to 14-days-ago."""
        now = datetime.utcnow()
        seven_days_ago = now - timedelta(days=7)
        fourteen_days_ago = now - timedelta(days=14)

        # Engagement in last 7 days
        current_engagement = await TrendingService._count_engagement_between(
            db, user_id, seven_days_ago, now
        )

        # Engagement 7-14 days ago
        previous_engagement = await TrendingService._count_engagement_between(
            db, user_id, fourteen_days_ago, seven_days_ago
        )

        if previous_engagement == 0:
            return min(1.0, current_engagement / 100.0)

        velocity = (current_engagement - previous_engagement) / max(previous_engagement, 1)
        # Clamp to -0.5 to +1.0 normalized range
        return max(-0.5, min(1.0, velocity))

    @staticmethod
    async def _count_engagement_between(
        db: AsyncSession, user_id: uuid.UUID, start: datetime, end: datetime
    ) -> int:
        """Count likes on user's posts within date range."""
        posts_result = await db.execute(
            select(Post.id).where(
                and_(Post.author_id == user_id, Post.created_at >= start, Post.created_at < end)
            )
        )
        post_ids = [p for (p,) in posts_result.all()]

        if not post_ids:
            return 0

        likes_result = await db.execute(
            select(func.count(PostLike.id)).where(PostLike.post_id.in_(post_ids))
        )
        return likes_result.scalar() or 0

    @staticmethod
    async def recalculate_score(db: AsyncSession, user_id: uuid.UUID) -> None:
        """Recalculate trending score for a user."""
        mc = await TrendingService.calculate_market_cap_component(db, user_id)
        hr = await TrendingService.calculate_hot_ratio_component(db, user_id)
        cp = await TrendingService.calculate_content_power_component(db, user_id)
        ev = await TrendingService.calculate_engagement_velocity_component(db, user_id)

        # Composite score: 35% + 30% + 20% + 15%
        composite = (mc * 0.35) + (hr * 0.30) + (cp * 0.20) + (ev * 0.15)

        score_result = await db.execute(
            select(ProfileTrendingScore).where(ProfileTrendingScore.user_id == user_id)
        )
        score = score_result.scalar_one_or_none()

        if score:
            score.market_cap_component = mc
            score.hot_ratio_component = hr
            score.content_power_component = cp
            score.engagement_velocity_component = ev
            score.composite_score = composite
            score.updated_at = datetime.utcnow()
        else:
            score = ProfileTrendingScore(
                user_id=user_id,
                market_cap_component=mc,
                hot_ratio_component=hr,
                content_power_component=cp,
                engagement_velocity_component=ev,
                composite_score=composite,
                updated_at=datetime.utcnow(),
            )
            db.add(score)

        await db.flush()

    @staticmethod
    async def recalculate_rankings(db: AsyncSession) -> None:
        """Recalculate trending ranks for all users (nightly job)."""
        # Get all scores, order by composite score desc
        scores_result = await db.execute(
            select(ProfileTrendingScore).order_by(desc(ProfileTrendingScore.composite_score))
        )
        scores = scores_result.scalars().all()

        # Assign ranks (top 20 get 1-20)
        for idx, score in enumerate(scores, 1):
            score.trending_rank = idx if idx <= 20 else None

        await db.commit()

    @staticmethod
    async def get_leaderboard(
        db: AsyncSession, metric: str, limit: int = 20, offset: int = 0
    ) -> list[dict]:
        """Get leaderboard by metric."""
        if metric == "rising-stars":
            order_by = desc(ProfileTrendingScore.engagement_velocity_component)
        elif metric == "most-invested":
            order_by = desc(User.tokens_invested_in_me)
        elif metric == "hottest":
            order_by = desc(ProfileTrendingScore.hot_ratio_component)
        elif metric == "content-kings":
            order_by = desc(ProfileTrendingScore.content_power_component)
        elif metric == "store-mvp":
            order_by = desc(User.total_sales_volume)
        else:
            order_by = desc(ProfileTrendingScore.composite_score)

        query = (
            select(User, ProfileTrendingScore)
            .join(ProfileTrendingScore, User.id == ProfileTrendingScore.user_id)
            .order_by(order_by)
            .offset(offset)
            .limit(limit)
        )

        result = await db.execute(query)
        rows = result.all()

        return [
            {
                "user_id": str(user.id),
                "username": user.username,
                "display_name": user.display_name,
                "avatar_url": user.avatar_url,
                "market_cap": user.market_cap,
                "trending_rank": score.trending_rank,
                "composite_score": score.composite_score,
                "hot_ratio": score.hot_ratio_component,
                "engagement_velocity": score.engagement_velocity_component,
            }
            for user, score in rows
        ]


class WalletService:
    """Manage user wallet points."""

    @staticmethod
    async def get_or_create_wallet(db: AsyncSession, user_id: uuid.UUID) -> WalletPoints:
        """Get user's wallet or create if doesn't exist."""
        result = await db.execute(
            select(WalletPoints).where(WalletPoints.user_id == user_id)
        )
        wallet = result.scalar_one_or_none()

        if not wallet:
            wallet = WalletPoints(id=uuid.uuid4(), user_id=user_id, balance=0)
            db.add(wallet)
            await db.flush()

        return wallet

    @staticmethod
    async def add_points(db: AsyncSession, user_id: uuid.UUID, amount: int, source: str) -> None:
        """Add points to user's wallet."""
        wallet = await WalletService.get_or_create_wallet(db, user_id)
        wallet.balance += amount
        wallet.total_earned += amount
        wallet.updated_at = datetime.utcnow()

        transaction = PointTransaction(
            id=uuid.uuid4(),
            to_user_id=user_id,
            from_user_id=None,
            amount=amount,
            transaction_type=source,  # "purchase", "daily_bonus", etc.
            status="completed",
        )
        db.add(transaction)
        await db.flush()

    @staticmethod
    async def transfer_points(
        db: AsyncSession, from_user_id: uuid.UUID, to_user_id: uuid.UUID, amount: int
    ) -> bool:
        """Transfer points from one user to another (with 25% platform fee)."""
        from_wallet = await WalletService.get_or_create_wallet(db, from_user_id)

        if from_wallet.balance < amount:
            return False

        to_wallet = await WalletService.get_or_create_wallet(db, to_user_id)

        # Transfer with 25% fee
        fee = int(amount * 0.25)
        actual_transfer = amount - fee

        from_wallet.balance -= amount
        from_wallet.total_spent += amount
        to_wallet.balance += actual_transfer
        to_wallet.total_earned += actual_transfer

        transaction = PointTransaction(
            id=uuid.uuid4(),
            from_user_id=from_user_id,
            to_user_id=to_user_id,
            amount=actual_transfer,
            transaction_type="support",
            status="completed",
        )
        db.add(transaction)
        await db.commit()

        return True

    @staticmethod
    async def buy_boost(
        db: AsyncSession, user_id: uuid.UUID, duration_hours: int = 24
    ) -> bool:
        """Purchase profile boost."""
        cost = 100  # points
        wallet = await WalletService.get_or_create_wallet(db, user_id)

        if wallet.balance < cost:
            return False

        wallet.balance -= cost
        wallet.total_spent += cost

        user_result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one()
        user.has_boost = True
        user.boost_expires_at = datetime.utcnow() + timedelta(hours=duration_hours)

        transaction = PointTransaction(
            id=uuid.uuid4(),
            from_user_id=user_id,
            to_user_id=user_id,
            amount=cost,
            transaction_type="boost",
            status="completed",
        )
        db.add(transaction)
        await db.commit()

        return True
