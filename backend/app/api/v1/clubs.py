"""Clubs — Discord-style campus group rooms."""
import uuid
from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user_id
from app.services.club_service import (
    create_club, list_clubs, get_club, join_club, leave_club, get_my_clubs,
    get_club_messages, send_club_message,
)

router = APIRouter(prefix="/clubs", tags=["clubs"])


class ClubCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: str | None = Field(None, max_length=500)
    icon_emoji: str = "🎓"
    is_public: bool = True


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    media_url: str | None = None
    media_type: str | None = None


@router.get("")
async def browse(search: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await list_clubs(db, search=search)


@router.post("")
async def create(body: ClubCreate, request: Request, db: AsyncSession = Depends(get_db)):
    user_id = uuid.UUID(get_current_user_id(request))
    return await create_club(db, user_id, body.name, body.description, body.icon_emoji, body.is_public)


@router.get("/mine")
async def my_clubs(request: Request, db: AsyncSession = Depends(get_db)):
    user_id = uuid.UUID(get_current_user_id(request))
    return await get_my_clubs(db, user_id)


@router.get("/{slug}")
async def get_one(slug: str, request: Request, db: AsyncSession = Depends(get_db)):
    try:
        user_id = uuid.UUID(get_current_user_id(request))
    except Exception:
        user_id = None
    return await get_club(db, slug, user_id)


@router.post("/{slug}/join")
async def join(slug: str, request: Request, db: AsyncSession = Depends(get_db)):
    user_id = uuid.UUID(get_current_user_id(request))
    return await join_club(db, user_id, slug)


@router.post("/{slug}/leave")
async def leave(slug: str, request: Request, db: AsyncSession = Depends(get_db)):
    user_id = uuid.UUID(get_current_user_id(request))
    return await leave_club(db, user_id, slug)


@router.get("/{slug}/messages")
async def messages(slug: str, request: Request, limit: int = Query(50, le=100), db: AsyncSession = Depends(get_db)):
    user_id = uuid.UUID(get_current_user_id(request))
    return await get_club_messages(db, slug, user_id, limit)


@router.post("/{slug}/messages")
async def send_message(slug: str, body: MessageCreate, request: Request, db: AsyncSession = Depends(get_db)):
    user_id = uuid.UUID(get_current_user_id(request))
    return await send_club_message(db, slug, user_id, body.content, body.media_url, body.media_type)
