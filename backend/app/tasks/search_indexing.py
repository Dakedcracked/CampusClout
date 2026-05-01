"""Scheduled job to refresh full-text search index.

Runs daily at 04:00 UTC. Rebuilds search_index table from users, posts, and rooms.
Cleans stale entries older than 30 days.
"""

import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, delete, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.models.user import User
from app.models.post import Post
from app.models.room import CommunityRoom
from app.models.search import SearchIndex

logger = logging.getLogger(__name__)


async def search_indexing_job() -> None:
    """Rebuild search index from users, posts, and rooms."""
    async with async_session_factory() as db:
        try:
            logger.info("Starting search index refresh job...")

            # Delete stale entries (older than 30 days)
            thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
            await db.execute(
                delete(SearchIndex).where(SearchIndex.updated_at < thirty_days_ago)
            )
            await db.commit()
            logger.info("Cleaned stale search index entries")

            # Index all users
            users = await db.execute(select(User))
            user_list = users.scalars().all()

            for user in user_list:
                search_text = f"{user.username} {user.display_name or ''} {user.bio or ''}".lower()

                # Check if exists, update or create
                stmt = select(SearchIndex).where(
                    SearchIndex.indexed_user_id == user.id,
                    SearchIndex.search_category == "USER",
                )
                result = await db.execute(stmt)
                existing = result.scalar_one_or_none()

                if existing:
                    existing.search_text = search_text
                    existing.updated_at = datetime.now(timezone.utc)
                else:
                    db.add(
                        SearchIndex(
                            indexed_user_id=user.id,
                            search_text=search_text,
                            search_category="USER",
                        )
                    )

            await db.commit()
            logger.info(f"Indexed {len(user_list)} users")

            # Index all posts
            posts = await db.execute(select(Post))
            post_list = posts.scalars().all()

            for post in post_list:
                search_text = post.content.lower() if post.content else ""

                stmt = select(SearchIndex).where(
                    SearchIndex.indexed_post_id == post.id,
                    SearchIndex.search_category == "POST",
                )
                result = await db.execute(stmt)
                existing = result.scalar_one_or_none()

                if existing:
                    existing.search_text = search_text
                    existing.updated_at = datetime.now(timezone.utc)
                else:
                    db.add(
                        SearchIndex(
                            indexed_post_id=post.id,
                            search_text=search_text,
                            search_category="POST",
                        )
                    )

            await db.commit()
            logger.info(f"Indexed {len(post_list)} posts")

            # Index all rooms
            rooms = await db.execute(select(CommunityRoom))
            room_list = rooms.scalars().all()

            for room in room_list:
                search_text = f"{room.name} {room.description or ''}".lower()

                stmt = select(SearchIndex).where(
                    SearchIndex.indexed_room_id == room.id,
                    SearchIndex.search_category == "ROOM",
                )
                result = await db.execute(stmt)
                existing = result.scalar_one_or_none()

                if existing:
                    existing.search_text = search_text
                    existing.updated_at = datetime.now(timezone.utc)
                else:
                    db.add(
                        SearchIndex(
                            indexed_room_id=room.id,
                            search_text=search_text,
                            search_category="ROOM",
                        )
                    )

            await db.commit()
            logger.info(f"Indexed {len(room_list)} rooms")
            logger.info("Search index refresh completed")

        except Exception as e:
            logger.error(f"Error in search indexing job: {e}", exc_info=True)
            await db.rollback()
            raise
