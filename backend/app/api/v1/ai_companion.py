import uuid

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis_client import get_redis
from app.core.security import get_current_user_id
from app.services.ai_companion_service import (
    get_companion_history,
    send_companion_message,
    set_companion_persona,
)

router = APIRouter(prefix="/ai/companion", tags=["ai-companion"])


class MessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)


class PersonaRequest(BaseModel):
    persona: str


@router.post("/message")
async def companion_message(
    body: MessageRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(get_current_user_id(request))
    redis = None
    try:
        redis = await get_redis()
    except Exception:
        pass
    return await send_companion_message(db, redis, user_id, body.message)


@router.get("/history")
async def companion_history(
    request: Request,
    limit: int = 40,
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(get_current_user_id(request))
    return await get_companion_history(db, user_id, limit=limit)


@router.patch("/persona")
async def update_persona(
    body: PersonaRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(get_current_user_id(request))
    return await set_companion_persona(db, user_id, body.persona)
