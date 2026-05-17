"""
Market-cap-weighted feed service.

Rank formula (computed in Python after a single JOIN query):

    rank = log10(max(market_cap, 1) + 1)      ← author authority
           × 1 / (1 + age_hours × 0.1)        ← recency decay
           × (1 + like_count × 0.1)            ← engagement boost

Higher market cap + fresher + more liked = higher rank.
Posts are never hidden — only ranked lower.
"""

import math
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.economy import CloutBalance, AlterEgo
from app.models.social import Post, PostLike
from app.models.user import User
from app.schemas.social import PostCreate, PostResponse


def _rank(market_cap: float, created_at: datetime, like_count: int) -> float:
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    age_hours = (datetime.now(timezone.utc) - created_at).total_seconds() / 3600
    if age_hours < 0:
        age_hours = 0
    
    # Base authority from 1 to ~5
    authority = math.log10(max(market_cap, 0) + 10)
    
    # Multipliers
    recency_multiplier = 1 / (1 + age_hours * 0.1)
    engagement = 1 + like_count * 0.2
    
    # Massive temporary boost for very new posts so they aren't buried instantly
    freshness_boost = 1000.0 * math.exp(-age_hours * 5.0)
    
    return (authority * recency_multiplier * engagement) + freshness_boost


async def create_post(
    db: AsyncSession, author_id: uuid.UUID, data: PostCreate
) -> PostResponse:
    alter_ego_alias: str | None = None
    is_alter_ego_post = False

    if data.post_as_alter_ego:
        ae_result = await db.execute(
            select(AlterEgo).where(AlterEgo.user_id == author_id, AlterEgo.is_active == True)
        )
        alter_ego = ae_result.scalar_one_or_none()
        if alter_ego:
            alter_ego_alias = alter_ego.alias
            is_alter_ego_post = True
        else:
            # Allow anonymous posting even without active alter-ego
            # Generate anonymous username like "Anonymous#1234"
            is_alter_ego_post = True
            alter_ego_alias = f"Anonymous#{uuid.uuid4().hex[:4].upper()}"

    user_result = await db.execute(
        select(User)
        .where(User.id == author_id)
        .options(selectinload(User.clout_balance))
    )
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    market_cap = user.clout_balance.market_cap if user.clout_balance else 0.0

    post = Post(
        author_id=author_id,
        content=data.content,
        is_alter_ego_post=is_alter_ego_post,
        alter_ego_alias=alter_ego_alias,
        media_url=data.media_url,
        media_type=data.media_type,
    )
    post.rank_score = _rank(market_cap, datetime.now(timezone.utc), 0)
    db.add(post)
    await db.commit()
    await db.refresh(post)

    return PostResponse(
        id=post.id,
        author_username=alter_ego_alias if is_alter_ego_post else user.username,
        author_display_name=None if is_alter_ego_post else user.display_name,
        author_avatar_url=None if is_alter_ego_post else user.avatar_url,
        author_market_cap=market_cap,
        content=post.content,
        like_count=0,
        comment_count=0,
        is_liked_by_me=False,
        rank_score=post.rank_score,
        is_alter_ego_post=is_alter_ego_post,
        alter_ego_alias=alter_ego_alias,
        media_url=post.media_url,
        media_type=post.media_type,
        created_at=post.created_at,
    )


async def get_feed(
    db: AsyncSession,
    viewer_id: uuid.UUID | None = None,
    limit: int = 30,
    offset: int = 0,
) -> list[PostResponse]:
    result = await db.execute(
        select(Post, User, CloutBalance)
        .join(User, Post.author_id == User.id)
        .join(CloutBalance, CloutBalance.user_id == User.id, isouter=True)  # LEFT JOIN — posts show even without balance
        .where(User.is_active == True)
        .order_by(Post.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = result.all()

    # Fetch liked state for the viewer in one query
    liked_ids: set[uuid.UUID] = set()
    page = rows
    if viewer_id and page:
        post_ids = [r[0].id for r in page]
        liked_result = await db.execute(
            select(PostLike.post_id).where(
                PostLike.user_id == viewer_id,
                PostLike.post_id.in_(post_ids),
            )
        )
        liked_ids = {row[0] for row in liked_result.all()}

    responses = []
    for post, user, balance in page:
        market_cap = balance.market_cap if balance else 0.0
        display_username = post.alter_ego_alias if post.is_alter_ego_post else user.username
        display_name = None if post.is_alter_ego_post else user.display_name
        # Get avatar URL from user (not from balance)
        author_avatar = user.avatar_url if not post.is_alter_ego_post else None
        responses.append(
            PostResponse(
                id=post.id,
                author_username=display_username,
                author_display_name=display_name,
                author_avatar_url=author_avatar,
                author_market_cap=market_cap,
                content=post.content,
                like_count=post.like_count,
                comment_count=post.comment_count or 0,
                is_liked_by_me=post.id in liked_ids,
                rank_score=_rank(market_cap, post.created_at, post.like_count),
                is_alter_ego_post=post.is_alter_ego_post,
                alter_ego_alias=post.alter_ego_alias,
                media_url=post.media_url,
                media_type=post.media_type,
                created_at=post.created_at,
            )
        )
    return responses


async def get_trending_posts(
    db: AsyncSession,
    viewer_id: uuid.UUID | None = None,
    limit: int = 20,
) -> list[PostResponse]:
    """Return posts ranked by clout (market cap × engagement × recency) for the Trending page."""
    # Highly optimized billion-scale trending query directly in SQL
    age_hours_expr = func.extract('epoch', func.now() - Post.created_at) / 3600
    base_score_expr = func.coalesce(CloutBalance.market_cap, 0.0) + (Post.like_count * 50)
    rank_expr = base_score_expr / func.power(age_hours_expr + 2, 1.5)

    result = await db.execute(
        select(Post, User, CloutBalance)
        .join(User, Post.author_id == User.id)
        .join(CloutBalance, CloutBalance.user_id == User.id, isouter=True)
        .where(User.is_active == True)
        .order_by(rank_expr.desc())
        .limit(limit)
    )
    page = result.all()

    # Fetch liked state
    liked_ids: set[uuid.UUID] = set()
    if viewer_id and page:
        post_ids = [r[0].id for r in page]
        liked_result = await db.execute(
            select(PostLike.post_id).where(
                PostLike.user_id == viewer_id,
                PostLike.post_id.in_(post_ids),
            )
        )
        liked_ids = {row[0] for row in liked_result.all()}

    responses = []
    for post, user, balance in page:
        market_cap = balance.market_cap if balance else 0.0
        display_username = post.alter_ego_alias if post.is_alter_ego_post else user.username
        display_name = None if post.is_alter_ego_post else user.display_name
        author_avatar = user.avatar_url if not post.is_alter_ego_post else None
        responses.append(
            PostResponse(
                id=post.id,
                author_username=display_username,
                author_display_name=display_name,
                author_avatar_url=author_avatar,
                author_market_cap=market_cap,
                content=post.content,
                like_count=post.like_count,
                comment_count=post.comment_count or 0,
                is_liked_by_me=post.id in liked_ids,
                rank_score=_rank(market_cap, post.created_at, post.like_count),
                is_alter_ego_post=post.is_alter_ego_post,
                alter_ego_alias=post.alter_ego_alias,
                media_url=post.media_url,
                media_type=post.media_type,
                created_at=post.created_at,
            )
        )
    return responses


async def toggle_like(
    db: AsyncSession, user_id: uuid.UUID, post_id: uuid.UUID
) -> tuple[bool, int]:
    """Returns (is_now_liked, new_like_count)."""
    post_result = await db.execute(select(Post).where(Post.id == post_id))
    post = post_result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = await db.execute(
        select(PostLike).where(PostLike.user_id == user_id, PostLike.post_id == post_id)
    )
    like = existing.scalar_one_or_none()

    if like:
        await db.delete(like)
        post.like_count = max(0, post.like_count - 1)
        liked = False
    else:
        db.add(PostLike(user_id=user_id, post_id=post_id))
        post.like_count += 1
        liked = True

    await db.commit()
    return liked, post.like_count


async def edit_post(
    db: AsyncSession, user_id: uuid.UUID, post_id: uuid.UUID, new_content: str
) -> PostResponse:
    """Edit post content. Only author can edit."""
    post_result = await db.execute(select(Post).where(Post.id == post_id))
    post = post_result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post.author_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this post")
    
    post.content = new_content
    await db.commit()
    await db.refresh(post)
    
    user_result = await db.execute(
        select(User)
        .where(User.id == post.author_id)
        .options(selectinload(User.clout_balance))
    )
    user = user_result.scalar_one_or_none()
    market_cap = user.clout_balance.market_cap if user and user.clout_balance else 0.0
    
    return PostResponse(
        id=post.id,
        author_username=post.alter_ego_alias if post.is_alter_ego_post else (user.username if user else "unknown"),
        author_display_name=None if post.is_alter_ego_post else (user.display_name if user else None),
        author_market_cap=market_cap,
        content=post.content,
        like_count=post.like_count,
        comment_count=post.comment_count or 0,
        is_liked_by_me=False,
        rank_score=_rank(market_cap, post.created_at, post.like_count),
        is_alter_ego_post=post.is_alter_ego_post,
        alter_ego_alias=post.alter_ego_alias,
        media_url=post.media_url,
        media_type=post.media_type,
        created_at=post.created_at,
    )


async def delete_post(db: AsyncSession, user_id: uuid.UUID, post_id: uuid.UUID) -> dict:
    """Delete post. Only author can delete."""
    post_result = await db.execute(select(Post).where(Post.id == post_id))
    post = post_result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post.author_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this post")
    
    await db.delete(post)
    await db.commit()
    return {"message": "Post deleted successfully"}
