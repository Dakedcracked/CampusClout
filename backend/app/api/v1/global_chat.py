import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis_client import get_redis
from app.core.security import get_current_user_id
from app.services.global_chat_service import get_recent_global_messages, send_global_message
from app.ws.global_manager import global_chat_manager

router = APIRouter(prefix="/global-chat", tags=["global-chat"])


@router.get("/history")
async def history(
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    redis_client: Redis = Depends(get_redis),
):
    return await get_recent_global_messages(db, redis=redis_client, limit=limit)


@router.get("/rush-hour")
async def rush_hour_status():
    active = await global_chat_manager.is_rush_hour()
    return {"rush_hour": active}


@router.post("/send")
async def send_message(
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis_client: Redis = Depends(get_redis),
):
    body = await request.json()
    content = (body.get("content") or "").strip()
    image_url = body.get("image_url") or None
    image_type = body.get("image_type") or None  # "image" or "video"
    
    if not content or len(content) > 500:
        raise HTTPException(status_code=400, detail="content must be 1-500 characters")
    
    user_id = uuid.UUID(get_current_user_id(request))
    result = await send_global_message(
        db, user_id, content, image_url=image_url, image_type=image_type, redis=redis_client
    )
    return result


@router.websocket("/ws")
async def global_chat_ws(
    websocket: WebSocket,
    ticket: str = Query(...),
):
    """WebSocket endpoint for the global chat room.

    Auth: pass ?ticket=<WS ticket> obtained from GET /api/v1/ws/ticket.
    """
    redis = None
    try:
        redis = await get_redis()
    except Exception:
        pass

    sender_id_str: str | None = None
    if redis:
        try:
            key = f"cc:ws_ticket:{ticket}"
            sender_id_str = await redis.get(key)
            if sender_id_str:
                await redis.delete(key)
        except Exception:
            pass

    if not sender_id_str:
        await websocket.close(code=4001)
        return

    await global_chat_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if not data or data == "ping":
                await websocket.send_text('{"event":"pong"}')
                continue
            # Messages sent over REST /send endpoint, WS is receive-only for push
    except WebSocketDisconnect:
        pass
    finally:
        global_chat_manager.disconnect(websocket)
