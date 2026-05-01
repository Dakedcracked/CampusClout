"""Scheduled job to recalculate user rating aggregates.

Runs daily at 02:00 UTC. Recalculates rating_score and rating_count
for all users based on user_ratings table entries from last 7 days.
"""

import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.models.user import User
from app.models.rating import UserRating

logger = logging.getLogger(__name__)


async def rating_aggregation_job() -> None:
    """Recalculate all users' rating scores from 7-day average."""
    async with async_session_factory() as db:
        try:
            logger.info("Starting rating aggregation job...")

            # Get all users
            stmt = select(User)
            result = await db.execute(stmt)
            users = result.scalars().all()

            seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

            for user in users:
                # Get ratings for this user from last 7 days
                rating_stmt = (
                    select(UserRating)
                    .where(
                        UserRating.rated_user_id == user.id,
                        UserRating.created_at >= seven_days_ago,
                    )
                )
                rating_result = await db.execute(rating_stmt)
                ratings = rating_result.scalars().all()

                if ratings:
                    # Calculate average score (1-10)
                    avg_score = sum(r.impression_score for r in ratings) / len(
                        ratings
                    )
                    # Convert to 0-100 scale
                    rating_score = (avg_score / 10.0) * 100.0

                    user.rating_score = rating_score
                    user.rating_count = len(ratings)
                    user.rating_updated_at = datetime.now(timezone.utc)
                else:
                    # No ratings, reset to defaults
                    user.rating_score = 0.0
                    user.rating_count = 0

            await db.commit()
            logger.info(
                f"Rating aggregation completed for {len(users)} users"
            )

        except Exception as e:
            logger.error(f"Error in rating aggregation job: {e}", exc_info=True)
            await db.rollback()
            raise
