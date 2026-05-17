"""Stories API routes."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.user import User
from app.models.story import Story

router = APIRouter(prefix="/stories", tags=["stories"])


class CreateStoryRequest(BaseModel):
    media_url: str
    media_type: str = "image"
    caption: Optional[str] = None


class StoryItemResponse(BaseModel):
    id: str
    media_url: str
    media_type: str
    caption: Optional[str]
    created_at: str
    expires_at: str


class StoryGroupResponse(BaseModel):
    user_id: str
    username: str
    display_name: Optional[str]
    avatar_url: Optional[str]
    has_unseen: bool
    stories: List[StoryItemResponse]


@router.get("", response_model=List[StoryGroupResponse])
async def list_stories(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Get all active stories grouped by user."""
    # Auth check
    try:
        get_current_user_id(request)
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")

    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Story).where(Story.expires_at > now).order_by(Story.created_at.desc())
    )
    stories = result.scalars().all()

    # Group by author
    grouped: dict[str, list] = {}
    for story in stories:
        grouped.setdefault(str(story.author_id), []).append(story)

    # Fetch authors
    author_map: dict[str, User] = {}
    if grouped:
        author_ids = [uuid.UUID(k) for k in grouped.keys()]
        authors_result = await db.execute(select(User).where(User.id.in_(author_ids)))
        for u in authors_result.scalars().all():
            author_map[str(u.id)] = u

    responses = []
    for uid, user_stories in grouped.items():
        author = author_map.get(uid)
        if not author:
            continue
        responses.append(StoryGroupResponse(
            user_id=uid,
            username=author.username,
            display_name=author.display_name,
            avatar_url=author.avatar_url,
            has_unseen=True,
            stories=[
                StoryItemResponse(
                    id=str(s.id),
                    media_url=s.media_url,
                    media_type=s.media_type,
                    caption=s.caption,
                    created_at=s.created_at.isoformat(),
                    expires_at=s.expires_at.isoformat(),
                )
                for s in user_stories
            ],
        ))

    return responses


@router.post("", status_code=201)
async def create_story(
    data: CreateStoryRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Create a new story (expires in 24h)."""
    current_user_id = uuid.UUID(get_current_user_id(request))
    story = Story(
        author_id=current_user_id,
        media_url=data.media_url,
        media_type=data.media_type,
        caption=data.caption,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(story)
    await db.commit()
    return {"id": str(story.id), "message": "Story created"}


@router.delete("/{story_id}")
async def delete_story(
    story_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    current_user_id = uuid.UUID(get_current_user_id(request))
    result = await db.execute(select(Story).where(Story.id == uuid.UUID(story_id)))
    story = result.scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    if story.author_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not your story")
    await db.delete(story)
    await db.commit()
    return {"message": "Deleted"}
