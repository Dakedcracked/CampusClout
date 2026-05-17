"""
Full-text search indexing service.

Indexes users, posts, and rooms into a unified search_index table.
Supports global search across all types and type-specific filtering.
"""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.search import SearchIndex
from app.models.social import Post
from app.models.room import CommunityRoom
from app.models.user import User
from app.models.social import Follow


async def index_user(db: AsyncSession, user_id: uuid.UUID) -> SearchIndex:
    """Add or update user in search index with username + display_name + bio."""
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Build searchable text
    search_text = " ".join(
        filter(None, [user.username, user.display_name, user.bio or ""])
    ).lower()
    
    # Check if index exists
    existing = await db.execute(
        select(SearchIndex).where(
            and_(
                SearchIndex.indexed_user_id == user_id,
                SearchIndex.search_category == "USER",
            )
        )
    )
    index = existing.scalar_one_or_none()
    
    if index:
        index.search_text = search_text
        index.updated_at = datetime.now(timezone.utc)
    else:
        index = SearchIndex(
            indexed_user_id=user_id,
            search_text=search_text,
            search_category="USER",
            updated_at=datetime.now(timezone.utc),
        )
        db.add(index)
    
    await db.commit()
    await db.refresh(index)
    return index


async def index_post(db: AsyncSession, post_id: uuid.UUID) -> SearchIndex:
    """Add or update post in search index with content."""
    post_result = await db.execute(select(Post).where(Post.id == post_id))
    post = post_result.scalar_one_or_none()
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Build searchable text
    search_text = post.content.lower()
    
    # Check if index exists
    existing = await db.execute(
        select(SearchIndex).where(
            and_(
                SearchIndex.indexed_post_id == post_id,
                SearchIndex.search_category == "POST",
            )
        )
    )
    index = existing.scalar_one_or_none()
    
    if index:
        index.search_text = search_text
        index.updated_at = datetime.now(timezone.utc)
    else:
        index = SearchIndex(
            indexed_post_id=post_id,
            search_text=search_text,
            search_category="POST",
            updated_at=datetime.now(timezone.utc),
        )
        db.add(index)
    
    await db.commit()
    await db.refresh(index)
    return index


async def index_room(db: AsyncSession, room_id: uuid.UUID) -> SearchIndex:
    """Add or update room in search index with name + description."""
    room_result = await db.execute(select(CommunityRoom).where(CommunityRoom.id == room_id))
    room = room_result.scalar_one_or_none()
    
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Build searchable text
    search_text = " ".join(
        filter(None, [room.name, room.description or ""])
    ).lower()
    
    # Check if index exists
    existing = await db.execute(
        select(SearchIndex).where(
            and_(
                SearchIndex.indexed_room_id == room_id,
                SearchIndex.search_category == "ROOM",
            )
        )
    )
    index = existing.scalar_one_or_none()
    
    if index:
        index.search_text = search_text
        index.updated_at = datetime.now(timezone.utc)
    else:
        index = SearchIndex(
            indexed_room_id=room_id,
            search_text=search_text,
            search_category="ROOM",
            updated_at=datetime.now(timezone.utc),
        )
        db.add(index)
    
    await db.commit()
    await db.refresh(index)
    return index


async def search_global(
    db: AsyncSession,
    query: str,
    skip: int = 0,
    limit: int = 20,
    current_user_id: uuid.UUID | None = None,
) -> list[dict]:
    """Global search across users, posts, and rooms.
    
    Returns list of {type, data} results.
    """
    query_lower = query.lower()
    
    result = await db.execute(
        select(SearchIndex)
        .where(SearchIndex.search_text.ilike(f"%{query_lower}%"))
        .order_by(SearchIndex.updated_at.desc())
        .offset(skip)
        .limit(limit)
    )
    indices = result.scalars().all()
    
    results = []
    for idx in indices:
        if idx.search_category == "USER":
            user_result = await db.execute(
                select(User).where(User.id == idx.indexed_user_id)
            )
            user = user_result.scalar_one_or_none()
            if user:
                # Check follow status if authenticated
                is_following = False
                if current_user_id and current_user_id != user.id:
                    follow_result = await db.execute(
                        select(Follow).where(
                            and_(
                                Follow.follower_id == current_user_id,
                                Follow.following_id == user.id,
                            )
                        )
                    )
                    is_following = follow_result.scalar_one_or_none() is not None
                
                results.append({
                    "type": "USER",
                    "data": {
                        "id": str(user.id),
                        "username": user.username,
                        "display_name": user.display_name,
                        "bio": user.bio,
                        "avatar_url": user.avatar_url,
                        "is_following": is_following,
                    },
                })
        
        elif idx.search_category == "POST":
            post_result = await db.execute(
                select(Post).where(Post.id == idx.indexed_post_id).options(
                    selectinload(Post.author)
                )
            )
            post = post_result.scalar_one_or_none()
            if post:
                # Check like status if authenticated
                is_liked = False
                if current_user_id:
                    from app.models.social import PostLike
                    like_result = await db.execute(
                        select(PostLike).where(
                            and_(
                                PostLike.user_id == current_user_id,
                                PostLike.post_id == post.id,
                            )
                        )
                    )
                    is_liked = like_result.scalar_one_or_none() is not None
                
                results.append({
                    "type": "POST",
                    "data": {
                        "id": str(post.id),
                        "author": {
                            "id": str(post.author.id),
                            "username": post.author.username,
                        },
                        "content": post.content[:100],
                        "like_count": post.like_count,
                        "is_liked": is_liked,
                    },
                })
        
        elif idx.search_category == "ROOM":
            room_result = await db.execute(
                select(CommunityRoom).where(CommunityRoom.id == idx.indexed_room_id)
            )
            room = room_result.scalar_one_or_none()
            if room:
                results.append({
                    "type": "ROOM",
                    "data": {
                        "id": str(room.id),
                        "name": room.name,
                        "description": room.description,
                        "member_count": room.member_count,
                        "is_active": room.is_active,
                    },
                })
    
    return results


async def search_users(
    db: AsyncSession,
    query: str,
    skip: int = 0,
    limit: int = 20,
    current_user_id: uuid.UUID | None = None,
) -> list[dict]:
    """Search users by username, display name, bio."""
    query_lower = query.lower()
    
    result = await db.execute(
        select(SearchIndex)
        .where(
            and_(
                SearchIndex.search_text.ilike(f"%{query_lower}%"),
                SearchIndex.search_category == "USER",
            )
        )
        .order_by(SearchIndex.updated_at.desc())
        .offset(skip)
        .limit(limit)
    )
    indices = result.scalars().all()
    
    users = []
    for idx in indices:
        user_result = await db.execute(
            select(User).where(User.id == idx.indexed_user_id)
        )
        user = user_result.scalar_one_or_none()
        if user:
            is_following = False
            if current_user_id and current_user_id != user.id:
                follow_result = await db.execute(
                    select(Follow).where(
                        and_(
                            Follow.follower_id == current_user_id,
                            Follow.following_id == user.id,
                        )
                    )
                )
                is_following = follow_result.scalar_one_or_none() is not None
            
            users.append({
                "id": str(user.id),
                "username": user.username,
                "display_name": user.display_name,
                "bio": user.bio,
                "avatar_url": user.avatar_url,
                "is_following": is_following,
            })
    
    return users


async def search_posts(
    db: AsyncSession,
    query: str,
    skip: int = 0,
    limit: int = 20,
    current_user_id: uuid.UUID | None = None,
) -> list[dict]:
    """Search posts by content."""
    query_lower = query.lower()
    
    result = await db.execute(
        select(SearchIndex)
        .where(
            and_(
                SearchIndex.search_text.ilike(f"%{query_lower}%"),
                SearchIndex.search_category == "POST",
            )
        )
        .order_by(SearchIndex.updated_at.desc())
        .offset(skip)
        .limit(limit)
    )
    indices = result.scalars().all()
    
    posts = []
    for idx in indices:
        post_result = await db.execute(
            select(Post).where(Post.id == idx.indexed_post_id).options(
                selectinload(Post.author)
            )
        )
        post = post_result.scalar_one_or_none()
        if post:
            is_liked = False
            if current_user_id:
                from app.models.social import PostLike
                like_result = await db.execute(
                    select(PostLike).where(
                        and_(
                            PostLike.user_id == current_user_id,
                            PostLike.post_id == post.id,
                        )
                    )
                )
                is_liked = like_result.scalar_one_or_none() is not None
            
            posts.append({
                "id": str(post.id),
                "author": {
                    "id": str(post.author.id),
                    "username": post.author.username,
                },
                "content": post.content,
                "like_count": post.like_count,
                "comment_count": post.comment_count,
                "is_liked": is_liked,
                "created_at": post.created_at.isoformat(),
            })
    
    return posts


async def search_rooms(
    db: AsyncSession, query: str, skip: int = 0, limit: int = 20
) -> list[dict]:
    """Search rooms by name + description."""
    query_lower = query.lower()
    
    result = await db.execute(
        select(SearchIndex)
        .where(
            and_(
                SearchIndex.search_text.ilike(f"%{query_lower}%"),
                SearchIndex.search_category == "ROOM",
            )
        )
        .order_by(SearchIndex.updated_at.desc())
        .offset(skip)
        .limit(limit)
    )
    indices = result.scalars().all()
    
    rooms = []
    for idx in indices:
        room_result = await db.execute(
            select(CommunityRoom).where(CommunityRoom.id == idx.indexed_room_id)
        )
        room = room_result.scalar_one_or_none()
        if room:
            rooms.append({
                "id": str(room.id),
                "name": room.name,
                "description": room.description,
                "member_count": room.member_count,
                "is_active": room.is_active,
                "created_at": room.created_at.isoformat(),
            })
    
    return rooms


async def rebuild_search_index(db: AsyncSession) -> None:
    """Rebuild entire search index. Called by scheduled job."""
    # Clear existing index
    await db.execute("TRUNCATE search_index")
    
    # Index all users
    user_result = await db.execute(select(User))
    users = user_result.scalars().all()
    for user in users:
        await index_user(db, user.id)
    
    # Index all posts
    post_result = await db.execute(select(Post))
    posts = post_result.scalars().all()
    for post in posts:
        await index_post(db, post.id)
    
    # Index all rooms
    room_result = await db.execute(select(CommunityRoom))
    rooms = room_result.scalars().all()
    for room in rooms:
        await index_room(db, room.id)
    
    await db.commit()
