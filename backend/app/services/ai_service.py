"""
Ollama icebreaker service.

Calls the local Ollama REST API to generate a context-aware icebreaker
when a chat thread has been idle for 5 minutes.

If Ollama is not running (connection refused) the function returns None and
the idle monitor skips the injection silently.
"""

import logging
from typing import TYPE_CHECKING

import httpx

from app.core.config import settings

if TYPE_CHECKING:
    from app.models.chat import ChatThread, ChatMessage

log = logging.getLogger(__name__)

OLLAMA_TIMEOUT = 20.0  # seconds


def _build_prompt(thread: "ChatThread", recent: list["ChatMessage"]) -> str:
    lines: list[str] = []
    for m in recent:
        if m.is_ai_icebreaker:
            label = "CampusBot"
        elif m.sender_id == thread.user_a_id:
            label = thread.user_a.username if thread.user_a else "User A"
        else:
            label = thread.user_b.username if thread.user_b else "User B"
        lines.append(f"{label}: {m.content}")

    history = "\n".join(lines) if lines else "(no messages yet)"

    return (
        "You are CampusBot, a friendly assistant on CampusClout — a university social trading app. "
        "Two students' conversation has gone quiet. "
        "Write ONE short, casual, witty icebreaker (max 2 sentences) to restart the chat. "
        "Do NOT use emojis. Do NOT add any explanation or label — just the message text.\n\n"
        f"Recent chat:\n{history}"
    )


async def generate_icebreaker(
    thread: "ChatThread",
    recent_messages: list["ChatMessage"],
) -> str | None:
    prompt = _build_prompt(thread, recent_messages)
    payload = {
        "model": settings.OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.8, "num_predict": 80},
    }
    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            resp = await client.post(f"{settings.OLLAMA_URL}/api/generate", json=payload)
            resp.raise_for_status()
            text = resp.json().get("response", "").strip()
            return text or None
    except httpx.ConnectError:
        log.info("Ollama not running — skipping icebreaker for thread %s", thread.id)
        return None
    except Exception as exc:
        log.warning("Ollama error for thread %s: %s", thread.id, exc)
        return None
