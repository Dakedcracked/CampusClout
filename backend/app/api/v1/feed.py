"""Feed API — posts, likes, comments, shares, and behavioral tracking."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.middleware.rate_limit import enforce_rate_limit
from app.models.social import Post
from app.schemas.social import PostCreate, PostResponse
from app.services.feed_service import create_post, delete_post, edit_post, get_feed, get_trending_posts, toggle_like
from app.services.social_service import (
    add_comment,
    checkin_streak,
    delete_comment,
    get_comments,
    get_post_likers,
    log_behavior,
    record_share,
    toggle_post_like,
)

router = APIRouter(prefix="/feed", tags=["feed"])


# ─── Feed ───────────────────────────────────────────────────────────────────────

@router.get("/trending", response_model=list[PostResponse])
async def trending_posts(
    request: Request,
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    viewer_id: uuid.UUID | None = None
    try:
        viewer_id = uuid.UUID(get_current_user_id(request))
    except Exception:
        pass
    return await get_trending_posts(db, viewer_id=viewer_id, limit=limit)


@router.get("", response_model=list[PostResponse])
async def read_feed(
    request: Request,
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    viewer_id: uuid.UUID | None = None
    try:
        viewer_id = uuid.UUID(get_current_user_id(request))
    except Exception:
        pass
    return await get_feed(db, viewer_id=viewer_id, limit=limit, offset=offset)


@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def new_post(
    data: PostCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    await enforce_rate_limit(request)
    author_id = uuid.UUID(get_current_user_id(request))
    post = await create_post(db, author_id, data)
    await log_behavior(db, author_id, "post_create", target_id=str(post.id) if hasattr(post, "id") else None, commit=True)
    return post


@router.put("/{post_id}", response_model=PostResponse)
async def edit_post_route(
    post_id: uuid.UUID,
    body: PostCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(get_current_user_id(request))
    return await edit_post(db, user_id, post_id, body.content)


@router.delete("/{post_id}", status_code=status.HTTP_200_OK)
async def delete_post_route(
    post_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(get_current_user_id(request))
    return await delete_post(db, user_id, post_id)


# ─── Likes ──────────────────────────────────────────────────────────────────────

@router.post("/{post_id}/like")
async def like_post(
    post_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Toggle like on a post. Returns {liked, like_count}."""
    user_id = uuid.UUID(get_current_user_id(request))
    return await toggle_post_like(db, user_id, post_id)


@router.get("/{post_id}/likes")
async def get_likers(
    post_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Who liked this post."""
    return await get_post_likers(db, post_id, limit=limit)


# ─── Comments ──────────────────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=1000)
    parent_id: uuid.UUID | None = None
    use_alter_ego: bool = False


@router.get("/{post_id}/comments")
async def get_comments_route(
    post_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=100),
    parent_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Get top-level comments or replies to a specific comment."""
    return await get_comments(db, post_id, limit=limit, parent_id=parent_id)


@router.post("/{post_id}/comments", status_code=status.HTTP_201_CREATED)
async def add_comment_route(
    post_id: uuid.UUID,
    body: CommentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    await enforce_rate_limit(request)
    author_id = uuid.UUID(get_current_user_id(request))
    alter_ego_alias: str | None = None
    if body.use_alter_ego:
        from app.models.economy import AlterEgo
        ae_r = await db.execute(
            select(AlterEgo).where(AlterEgo.user_id == author_id, AlterEgo.is_active == True)
        )
        ae = ae_r.scalar_one_or_none()
        alter_ego_alias = ae.alias if ae else None

    return await add_comment(
        db,
        post_id=post_id,
        author_id=author_id,
        content=body.content,
        parent_id=body.parent_id,
        alter_ego_active=body.use_alter_ego,
        alter_ego_alias=alter_ego_alias,
    )


@router.delete("/{post_id}/comments/{comment_id}")
async def delete_comment_route(
    post_id: uuid.UUID,
    comment_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(get_current_user_id(request))
    return await delete_comment(db, comment_id, user_id)


# ─── Shares ────────────────────────────────────────────────────────────────────

@router.post("/{post_id}/share")
async def share_post(
    post_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(get_current_user_id(request))
    return await record_share(db, user_id, post_id)


# ─── Behavioral Tracking ────────────────────────────────────────────────────────

class BehaviorEvent(BaseModel):
    event_type: str = Field(max_length=64)
    target_id: str | None = None
    metadata: dict | None = None
    session_id: str | None = None


@router.post("/track", status_code=status.HTTP_204_NO_CONTENT)
async def track_behavior(
    body: BehaviorEvent,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Client-side behavioral event tracking endpoint.
    Used for AI profiling: profile views, scroll depth, story views, etc.
    """
    try:
        user_id = uuid.UUID(get_current_user_id(request))
    except Exception:
        return  # Anonymous — skip

    allowed_events = {
        "profile_view", "post_view", "story_view", "story_view_complete",
        "search_query", "room_join", "swipe_right", "swipe_left",
        "session_start", "session_end", "scroll_depth", "reaction",
    }
    if body.event_type not in allowed_events:
        return  # Silently ignore unknown events

    await log_behavior(
        db,
        user_id=user_id,
        event_type=body.event_type,
        target_id=body.target_id,
        metadata=body.metadata,
        session_id=body.session_id,
        commit=True,
    )


# ─── Daily Streak ───────────────────────────────────────────────────────────────

@router.post("/streak/checkin")
async def streak_checkin(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Call on every app open. Returns streak data and token reward."""
    user_id = uuid.UUID(get_current_user_id(request))
    return await checkin_streak(db, user_id)
