import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.room import CommunityRoom
from app.models.social import Post
from app.models.user import User
from app.models.economy import CloutBalance
from app.schemas.search import SearchResponse, SearchItem, SearchResultPost, SearchResultRoom, SearchResultUser

router = APIRouter(prefix="/search", tags=["search"])


async def _search_users(db: AsyncSession, q: str, limit: int, skip: int) -> list[SearchItem]:
    """Search users by username, display_name, bio using trigram similarity."""
    pattern = f"%{q}%"

    result = await db.execute(
        select(User)
        .where(
            and_(
                User.is_active == True,
                or_(
                    User.username.ilike(pattern),
                    User.display_name.ilike(pattern),
                    User.bio.ilike(pattern),
                )
            )
        )
        .order_by(
            # Prioritize exact username prefix matches, then by follower count
            (User.username.ilike(f"{q}%")).desc(),
            User.follower_count.desc(),
        )
        .offset(skip)
        .limit(limit)
    )
    users = result.scalars().all()

    return [
        SearchItem(
            type="user",
            data=SearchResultUser(
                id=u.id,
                username=u.username,
                display_name=u.display_name,
                avatar_url=u.avatar_url,
                bio=u.bio,
                follower_count=u.follower_count,
                rating_score=u.rating_score,
                rating_count=u.rating_count,
            ),
        )
        for u in users
    ]


async def _search_posts(db: AsyncSession, q: str, limit: int, skip: int) -> list[SearchItem]:
    """Search posts by content."""
    pattern = f"%{q}%"

    result = await db.execute(
        select(Post)
        .where(Post.content.ilike(pattern))
        .options(selectinload(Post.author))
        .order_by(Post.rank_score.desc(), Post.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    posts = result.scalars().all()

    return [
        SearchItem(
            type="post",
            data=SearchResultPost(
                id=p.id,
                author_id=p.author_id,
                author_username=p.author.username if p.author else "unknown",
                content=p.content,
                like_count=p.like_count,
                created_at=p.created_at,
            ),
        )
        for p in posts
    ]


async def _search_rooms(db: AsyncSession, q: str, limit: int, skip: int) -> list[SearchItem]:
    """Search rooms by name or description."""
    pattern = f"%{q}%"

    result = await db.execute(
        select(CommunityRoom)
        .where(
            and_(
                CommunityRoom.is_active == True,
                or_(
                    CommunityRoom.name.ilike(pattern),
                    CommunityRoom.description.ilike(pattern),
                )
            )
        )
        .order_by(CommunityRoom.member_count.desc())
        .offset(skip)
        .limit(limit)
    )
    rooms = result.scalars().all()

    return [
        SearchItem(
            type="room",
            data=SearchResultRoom(
                id=r.id,
                name=r.name,
                description=r.description,
                creator_id=r.creator_id,
                member_count=r.member_count,
                created_at=r.created_at,
            ),
        )
        for r in rooms
    ]


@router.get("/global", response_model=SearchResponse)
async def search_global(
    q: str = Query(..., min_length=1, max_length=100),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> SearchResponse:
    """Search across users, posts, and rooms with proper indexing."""
    per_type = max(limit // 3, 5)

    users = await _search_users(db, q, per_type, 0)
    posts = await _search_posts(db, q, per_type, 0)
    rooms = await _search_rooms(db, q, per_type, 0)

    results = users + posts + rooms
    return SearchResponse(results=results, total=len(results))


@router.get("/users", response_model=SearchResponse)
async def search_users_endpoint(
    q: str = Query(..., min_length=1, max_length=100),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> SearchResponse:
    results = await _search_users(db, q, limit, skip)
    return SearchResponse(results=results, total=len(results))


@router.get("/posts", response_model=SearchResponse)
async def search_posts_endpoint(
    q: str = Query(..., min_length=1, max_length=100),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> SearchResponse:
    results = await _search_posts(db, q, limit, skip)
    return SearchResponse(results=results, total=len(results))


@router.get("/rooms", response_model=SearchResponse)
async def search_rooms_endpoint(
    q: str = Query(..., min_length=1, max_length=100),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> SearchResponse:
    results = await _search_rooms(db, q, limit, skip)
    return SearchResponse(results=results, total=len(results))
