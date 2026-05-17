"""
WebSocket endpoints.

/ws/ticker          — public; streams live market-cap events.
/ws/chat/{thread_id} — authenticated via ?ticket= query param (see POST /auth/ws-ticket).
"""

import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.ws.manager import ws_manager
from app.ws.chat_manager import chat_manager

router = APIRouter(prefix="/ws", tags=["websocket"])


@router.websocket("/ticker")
async def ticker(websocket: WebSocket) -> None:
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


async def _resolve_ticket(websocket: WebSocket, ticket: str) -> str | None:
    """Returns user_id string or None if the ticket is invalid/expired."""
    redis = getattr(websocket.app.state, "redis", None)

    # Dev fallback: ticket encoded as "dev:{user_id}"
    if ticket.startswith("dev:"):
        return ticket[4:]

    if not redis:
        return None

    user_id = await redis.getdel(f"cc:ws_ticket:{ticket}")
    return user_id  # None if expired or not found


@router.websocket("/chat/{thread_id}")
async def chat_ws(
    websocket: WebSocket,
    thread_id: uuid.UUID,
    ticket: str = Query(..., description="Single-use WS auth ticket from POST /auth/ws-ticket"),
) -> None:
    user_id = await _resolve_ticket(websocket, ticket)
    if not user_id:
        await websocket.close(code=4001, reason="Invalid or expired ticket")
        return

    # Verify the user is actually a participant before accepting
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import select
    from app.models.chat import ChatThread

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ChatThread).where(ChatThread.id == thread_id)
        )
        thread = result.scalar_one_or_none()

    if not thread or user_id not in (str(thread.user_a_id), str(thread.user_b_id)):
        await websocket.close(code=4003, reason="Not a participant in this thread")
        return

    thread_key = str(thread_id)
    await chat_manager.connect(thread_key, user_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # discard client pings
    except WebSocketDisconnect:
        chat_manager.disconnect(thread_key, user_id, websocket)
    except Exception:
        chat_manager.disconnect(thread_key, user_id, websocket)
