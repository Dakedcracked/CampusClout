"""
Complete social engagement service:
- Like/unlike with WS notification
- Threaded comments with reply support
- Share tracking
- Behavioral event logging for AI profiling
- Daily streak check-in
"""
import json
import uuid
from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models.social import Follow, Post, PostComment, PostLike, PostShare
from app.models.user import User
from app.models.behavior import DailyStreak, UserBehavior


# ─── Like / Unlike ────────────────────────────────────────────────────────────

async def toggle_post_like(
    db: AsyncSession,
    user_id: uuid.UUID,
    post_id: uuid.UUID,
) -> dict:
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
        post.like_count = max(0, (post.like_count or 0) - 1)
        liked = False
    else:
        db.add(PostLike(user_id=user_id, post_id=post_id))
        post.like_count = (post.like_count or 0) + 1
        liked = True

    await db.commit()

    # Fire WS notification to post author if liked (not self-like)
    if liked and post.author_id != user_id:
        try:
            from app.ws.manager import ws_manager
            await ws_manager.broadcast({
                "type": "notification",
                "subtype": "post_like",
                "target_user_id": str(post.author_id),
                "post_id": str(post_id),
                "actor_id": str(user_id),
            })
        except Exception:
            pass

    # Track behavior
    await log_behavior(db, user_id, "post_like" if liked else "post_unlike",
                       target_id=str(post_id), commit=True)

    return {"post_id": str(post_id), "liked": liked, "like_count": post.like_count}


async def get_post_likers(db: AsyncSession, post_id: uuid.UUID, limit: int = 50) -> list[dict]:
    result = await db.execute(
        select(User)
        .join(PostLike, PostLike.user_id == User.id)
        .where(PostLike.post_id == post_id)
        .order_by(PostLike.created_at.desc())
        .limit(limit)
    )
    users = result.scalars().all()
    return [
        {
            "username": u.username,
            "display_name": u.display_name,
            "avatar_url": u.avatar_url,
        }
        for u in users
    ]


# ─── Comments ─────────────────────────────────────────────────────────────────

async def add_comment(
    db: AsyncSession,
    post_id: uuid.UUID,
    author_id: uuid.UUID,
    content: str,
    parent_id: uuid.UUID | None = None,
    alter_ego_active: bool = False,
    alter_ego_alias: str | None = None,
) -> dict:
    post_result = await db.execute(select(Post).where(Post.id == post_id))
    post = post_result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Validate parent belongs to same post
    if parent_id:
        parent_result = await db.execute(
            select(PostComment).where(PostComment.id == parent_id, PostComment.post_id == post_id)
        )
        if not parent_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Parent comment not found in this post")

    comment = PostComment(
        post_id=post_id,
        author_id=author_id,
        parent_id=parent_id,
        content=content.strip()[:1000],
        is_alter_ego=alter_ego_active and bool(alter_ego_alias),
        alter_ego_alias=alter_ego_alias if alter_ego_active else None,
    )
    db.add(comment)
    # Only bump count for top-level comments
    if not parent_id:
        post.comment_count = (post.comment_count or 0) + 1
    await db.commit()
    await db.refresh(comment)

    author_result = await db.execute(select(User).where(User.id == author_id))
    author = author_result.scalar_one()

    # WS notification to post author
    if post.author_id != author_id:
        try:
            from app.ws.manager import ws_manager
            await ws_manager.broadcast({
                "type": "notification",
                "subtype": "post_comment",
                "target_user_id": str(post.author_id),
                "post_id": str(post_id),
                "actor_id": str(author_id),
                "preview": content[:60],
            })
        except Exception:
            pass

    await log_behavior(db, author_id, "post_comment", target_id=str(post_id), commit=True)

    return {
        "id": str(comment.id),
        "post_id": str(post_id),
        "parent_id": str(parent_id) if parent_id else None,
        "content": comment.content,
        "is_alter_ego": comment.is_alter_ego,
        "author": comment.alter_ego_alias if comment.is_alter_ego else author.username,
        "avatar_url": None if comment.is_alter_ego else author.avatar_url,
        "display_name": None if comment.is_alter_ego else author.display_name,
        "like_count": 0,
        "created_at": comment.created_at.isoformat(),
    }


async def get_comments(
    db: AsyncSession,
    post_id: uuid.UUID,
    limit: int = 50,
    parent_id: uuid.UUID | None = None,
) -> list[dict]:
    """Return top-level comments (parent_id=None) or replies to a specific comment."""
    query = (
        select(PostComment, User)
        .join(User, User.id == PostComment.author_id)
        .where(
            PostComment.post_id == post_id,
            PostComment.is_deleted == False,
            PostComment.parent_id == parent_id,
        )
        .order_by(PostComment.created_at.asc())
        .limit(limit)
    )
    result = await db.execute(query)
    rows = result.all()

    comments = []
    for c, u in rows:
        # Get reply count
        reply_count_result = await db.execute(
            select(func.count()).where(PostComment.parent_id == c.id, PostComment.is_deleted == False)
        )
        reply_count = reply_count_result.scalar() or 0
        comments.append({
            "id": str(c.id),
            "post_id": str(post_id),
            "parent_id": str(c.parent_id) if c.parent_id else None,
            "content": c.content,
            "is_alter_ego": c.is_alter_ego,
            "author": c.alter_ego_alias if c.is_alter_ego else u.username,
            "avatar_url": None if c.is_alter_ego else u.avatar_url,
            "display_name": None if c.is_alter_ego else u.display_name,
            "like_count": c.like_count,
            "reply_count": reply_count,
            "created_at": c.created_at.isoformat(),
        })
    return comments


async def delete_comment(
    db: AsyncSession, comment_id: uuid.UUID, user_id: uuid.UUID
) -> dict:
    result = await db.execute(select(PostComment).where(PostComment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != user_id:
        raise HTTPException(status_code=403, detail="Not your comment")
    comment.is_deleted = True
    comment.content = "[deleted]"
    await db.commit()
    return {"deleted": True}


# ─── Share ─────────────────────────────────────────────────────────────────────

async def record_share(db: AsyncSession, user_id: uuid.UUID, post_id: uuid.UUID) -> dict:
    post_result = await db.execute(select(Post).where(Post.id == post_id))
    post = post_result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    db.add(PostShare(post_id=post_id, user_id=user_id))
    await db.commit()
    await log_behavior(db, user_id, "post_share", target_id=str(post_id), commit=True)
    return {"shared": True, "post_id": str(post_id)}


# ─── Follow ────────────────────────────────────────────────────────────────────

async def toggle_follow(db: AsyncSession, follower_id: uuid.UUID, target_username: str) -> dict:
    target_result = await db.execute(select(User).where(User.username == target_username.lower()))
    target = target_result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == follower_id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    follower_result = await db.execute(select(User).where(User.id == follower_id))
    follower = follower_result.scalar_one()

    existing_result = await db.execute(
        select(Follow).where(Follow.follower_id == follower_id, Follow.following_id == target.id)
    )
    existing = existing_result.scalar_one_or_none()

    if existing:
        await db.delete(existing)
        target.follower_count = max(0, (target.follower_count or 0) - 1)
        follower.following_count = max(0, (follower.following_count or 0) - 1)
        is_following = False
    else:
        db.add(Follow(follower_id=follower_id, following_id=target.id))
        target.follower_count = (target.follower_count or 0) + 1
        follower.following_count = (follower.following_count or 0) + 1
        is_following = True
        # WS notification
        try:
            from app.ws.manager import ws_manager
            await ws_manager.broadcast({
                "type": "notification",
                "subtype": "new_follower",
                "target_user_id": str(target.id),
                "actor_id": str(follower_id),
                "actor_username": follower.username,
            })
        except Exception:
            pass

    await db.commit()
    await log_behavior(
        db, follower_id, "follow" if is_following else "unfollow",
        target_id=target.username, commit=True
    )
    return {
        "username": target.username,
        "is_following": is_following,
        "follower_count": target.follower_count,
    }


async def get_follow_status(db: AsyncSession, viewer_id: uuid.UUID, target_username: str) -> dict:
    target_result = await db.execute(select(User).where(User.username == target_username.lower()))
    target = target_result.scalar_one_or_none()
    if not target:
        return {"is_following": False}
    existing_result = await db.execute(
        select(Follow).where(Follow.follower_id == viewer_id, Follow.following_id == target.id)
    )
    return {
        "is_following": existing_result.scalar_one_or_none() is not None,
        "follower_count": target.follower_count,
        "following_count": target.following_count,
    }


# ─── Behavioral Tracking ───────────────────────────────────────────────────────

async def log_behavior(
    db: AsyncSession,
    user_id: uuid.UUID,
    event_type: str,
    target_id: str | None = None,
    metadata: dict | None = None,
    session_id: str | None = None,
    commit: bool = False,
) -> None:
    """Fire-and-forget behavioral telemetry. Never raises."""
    try:
        event = UserBehavior(
            user_id=user_id,
            event_type=event_type,
            target_id=target_id,
            metadata_json=json.dumps(metadata) if metadata else None,
            session_id=session_id,
        )
        db.add(event)
        if commit:
            await db.commit()
    except Exception:
        pass


# ─── Daily Streak ──────────────────────────────────────────────────────────────

async def checkin_streak(db: AsyncSession, user_id: uuid.UUID) -> dict:
    """Called on every login. Updates streak and returns reward tokens."""
    today = date.today()

    result = await db.execute(select(DailyStreak).where(DailyStreak.user_id == user_id))
    streak = result.scalar_one_or_none()

    if not streak:
        streak = DailyStreak(user_id=user_id)
        db.add(streak)

    bonus_tokens = 0
    if streak.last_checkin_date == today:
        # Already checked in today
        return {
            "streak": streak.current_streak,
            "longest": streak.longest_streak,
            "bonus_tokens": 0,
            "already_checked_in": True,
        }

    yesterday = date.fromordinal(today.toordinal() - 1)
    if streak.last_checkin_date == yesterday:
        streak.current_streak += 1
    else:
        streak.current_streak = 1  # Reset streak

    streak.last_checkin_date = today
    streak.total_checkins += 1
    streak.longest_streak = max(streak.longest_streak, streak.current_streak)

    # Variable reward schedule (Skinner box)
    if streak.current_streak >= 30:
        bonus_tokens = 500
    elif streak.current_streak >= 14:
        bonus_tokens = 200
    elif streak.current_streak >= 7:
        bonus_tokens = 100
    elif streak.current_streak >= 3:
        bonus_tokens = 30
    else:
        bonus_tokens = 10

    # Award tokens
    if bonus_tokens > 0:
        from app.models.economy import CloutBalance
        bal_result = await db.execute(select(CloutBalance).where(CloutBalance.user_id == user_id))
        bal = bal_result.scalar_one_or_none()
        if bal:
            bal.wallet_balance += bonus_tokens

    await db.commit()
    return {
        "streak": streak.current_streak,
        "longest": streak.longest_streak,
        "bonus_tokens": bonus_tokens,
        "already_checked_in": False,
    }
