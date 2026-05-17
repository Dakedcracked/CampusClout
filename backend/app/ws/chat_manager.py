"""
Chat WebSocket manager.

Tracks per-thread connections so:
  • Messages are delivered only to participants of that thread.
  • The idle monitor can check whether anyone is actually connected before
    injecting an AI icebreaker.

Uses Redis pub/sub (channel cc:chat:{thread_id}) so multiple API instances
can exchange messages. Gracefully degrades to in-process broadcast if Redis
is unavailable.
"""

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect
from redis.asyncio import Redis

log = logging.getLogger(__name__)


class ChatManager:
    def __init__(self) -> None:
        # thread_id → list of (user_id, websocket)
        self._threads: dict[str, list[tuple[str, WebSocket]]] = {}
        self._redis: Redis | None = None
        self._listener_tasks: dict[str, asyncio.Task] = {}

    def wire_redis(self, redis: Redis) -> None:
        self._redis = redis

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    async def connect(self, thread_id: str, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._threads.setdefault(thread_id, []).append((user_id, ws))
        if self._redis and thread_id not in self._listener_tasks:
            task = asyncio.create_task(
                self._listen(thread_id), name=f"chat_listener_{thread_id}"
            )
            self._listener_tasks[thread_id] = task
        log.debug("Chat connect thread=%s user=%s", thread_id, user_id)

    def disconnect(self, thread_id: str, user_id: str, ws: WebSocket) -> None:
        if thread_id in self._threads:
            self._threads[thread_id] = [
                (u, w) for u, w in self._threads[thread_id] if w is not ws
            ]
            if not self._threads[thread_id]:
                del self._threads[thread_id]
                task = self._listener_tasks.pop(thread_id, None)
                if task:
                    task.cancel()

    def has_connections(self, thread_id: str) -> bool:
        return bool(self._threads.get(thread_id))

    # ------------------------------------------------------------------
    # Broadcast
    # ------------------------------------------------------------------

    async def broadcast(self, thread_id: str, data: dict[str, Any]) -> None:
        dead: list[tuple[str, WebSocket]] = []
        payload = json.dumps(data, default=str)
        for pair in list(self._threads.get(thread_id, [])):
            try:
                await pair[1].send_text(payload)
            except Exception:
                dead.append(pair)
        if dead and thread_id in self._threads:
            self._threads[thread_id] = [p for p in self._threads[thread_id] if p not in dead]

    async def publish(self, thread_id: str, data: dict[str, Any]) -> None:
        if not self._redis:
            await self.broadcast(thread_id, data)
            return
        channel = f"cc:chat:{thread_id}"
        try:
            await self._redis.publish(channel, json.dumps(data, default=str))
        except Exception as exc:
            log.warning("Chat Redis publish failed: %s", exc)
            await self.broadcast(thread_id, data)

    # ------------------------------------------------------------------
    # Redis pub/sub listener per active thread
    # ------------------------------------------------------------------

    async def _listen(self, thread_id: str) -> None:
        assert self._redis is not None
        channel = f"cc:chat:{thread_id}"
        pubsub = self._redis.pubsub()
        await pubsub.subscribe(channel)
        try:
            async for message in pubsub.listen():
                if message.get("type") == "message":
                    try:
                        data = json.loads(message["data"])
                        await self.broadcast(thread_id, data)
                    except Exception:
                        pass
        except asyncio.CancelledError:
            pass
        finally:
            try:
                await pubsub.unsubscribe(channel)
                await pubsub.aclose()
            except Exception:
                pass


chat_manager = ChatManager()
