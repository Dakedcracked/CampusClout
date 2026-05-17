"""
Background task that fires Ollama icebreakers into idle chat threads.

Every CHECK_INTERVAL seconds it queries for threads where:
  • last_message_at is older than IDLE_THRESHOLD
  • No icebreaker has been sent since the last human message
  • At least one participant is connected via WebSocket right now

If those conditions hold it calls Ollama, injects the icebreaker, and marks
last_icebreaker_at so the same idle period doesn't trigger a second injection.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.models.chat import ChatMessage, ChatThread
from app.models.user import User
from app.services.ai_service import generate_icebreaker
from app.services.chat_service import inject_ai_message
from app.ws.chat_manager import chat_manager

log = logging.getLogger(__name__)

IDLE_THRESHOLD = timedelta(minutes=5)
CHECK_INTERVAL = 60  # seconds
RECENT_MESSAGE_COUNT = 5  # context window for Ollama


async def _process_idle_threads() -> None:
    cutoff = datetime.now(timezone.utc) - IDLE_THRESHOLD
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ChatThread)
            .where(
                ChatThread.last_message_at < cutoff,
                ChatThread.last_message_at.isnot(None),
                (ChatThread.last_icebreaker_at.is_(None))
                | (ChatThread.last_icebreaker_at < ChatThread.last_message_at),
            )
            .options(
                selectinload(ChatThread.user_a),
                selectinload(ChatThread.user_b),
            )
        )
        threads = result.scalars().all()

        for thread in threads:
            if not chat_manager.has_connections(str(thread.id)):
                continue  # nobody is online, skip

            # Fetch recent messages for context
            msgs_result = await db.execute(
                select(ChatMessage)
                .where(ChatMessage.thread_id == thread.id)
                .options(selectinload(ChatMessage.sender))
                .order_by(ChatMessage.created_at.desc())
                .limit(RECENT_MESSAGE_COUNT)
            )
            recent = list(reversed(msgs_result.scalars().all()))

            icebreaker_text = await generate_icebreaker(thread, recent)
            if icebreaker_text:
                await inject_ai_message(db, thread, icebreaker_text)
                log.info(
                    "Icebreaker injected into thread %s: %s…",
                    thread.id,
                    icebreaker_text[:40],
                )


async def idle_monitor_task() -> None:
    log.info("Idle monitor started — checking every %ds, threshold %s", CHECK_INTERVAL, IDLE_THRESHOLD)
    while True:
        try:
            await asyncio.sleep(CHECK_INTERVAL)
            await _process_idle_threads()
        except asyncio.CancelledError:
            log.info("Idle monitor stopped")
            break
        except Exception as exc:
            log.error("Idle monitor error: %s", exc, exc_info=True)
