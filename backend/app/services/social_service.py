"""Comments and Follow system."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.social import Follow, Post, PostComment
from app.models.user import User


async def add_comment(
    db: AsyncSession,
    post_id: uuid.UUID,
    author_id: uuid.UUID,
    content: str,
    alter_ego_active: bool = False,
    alter_ego_alias: str | None = None,
) -> dict:
    post_result = await db.execute(select(Post).where(Post.id == post_id))
    post = post_result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comment = PostComment(
        post_id=post_id,
        author_id=author_id,
        content=content.strip()[:500],
        is_alter_ego=alter_ego_active and bool(alter_ego_alias),
        alter_ego_alias=alter_ego_alias if alter_ego_active else None,
    )
    db.add(comment)
    post.comment_count = (post.comment_count or 0) + 1
    await db.commit()
    await db.refresh(comment)

    author_result = await db.execute(select(User).where(User.id == author_id))
    author = author_result.scalar_one()

    return {
        "id": str(comment.id),
        "post_id": str(post_id),
        "content": comment.content,
        "is_alter_ego": comment.is_alter_ego,
        "author": comment.alter_ego_alias if comment.is_alter_ego else author.username,
        "display_name": None if comment.is_alter_ego else author.display_name,
        "created_at": comment.created_at.isoformat(),
    }


async def get_comments(db: AsyncSession, post_id: uuid.UUID, limit: int = 30) -> list[dict]:
    result = await db.execute(
        select(PostComment, User)
        .join(User, User.id == PostComment.author_id)
        .where(PostComment.post_id == post_id)
        .order_by(PostComment.created_at.asc())
        .limit(limit)
    )
    rows = result.all()
    return [
        {
            "id": str(c.id),
            "content": c.content,
            "is_alter_ego": c.is_alter_ego,
            "author": c.alter_ego_alias if c.is_alter_ego else u.username,
            "display_name": None if c.is_alter_ego else u.display_name,
            "created_at": c.created_at.isoformat(),
        }
        for c, u in rows
    ]


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
        db.delete(existing)
        target.follower_count = max(0, (target.follower_count or 0) - 1)
        follower.following_count = max(0, (follower.following_count or 0) - 1)
        is_following = False
    else:
        follow = Follow(follower_id=follower_id, following_id=target.id)
        db.add(follow)
        target.follower_count = (target.follower_count or 0) + 1
        follower.following_count = (follower.following_count or 0) + 1
        is_following = True

    await db.commit()
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
