"""
Global campus chat WebSocket manager.

All connected clients receive every message in real time.
Redis pub/sub fans out across multiple server instances.
"""

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket
from redis.asyncio import Redis

log = logging.getLogger(__name__)

CHANNEL = "cc:global_chat"
RUSH_HOUR_KEY = "cc:rush_hour_active"


class GlobalChatManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._redis: Redis | None = None
        self._listener_task: asyncio.Task | None = None

    def wire_redis(self, redis: Redis) -> None:
        self._redis = redis

    async def is_rush_hour(self) -> bool:
        if not self._redis:
            return False
        val = await self._redis.get(RUSH_HOUR_KEY)
        return val == "1"

    async def set_rush_hour(self, active: bool) -> None:
        if not self._redis:
            return
        if active:
            await self._redis.set(RUSH_HOUR_KEY, "1")
        else:
            await self._redis.delete(RUSH_HOUR_KEY)
        await self.publish({
            "event": "rush_hour_change",
            "active": active,
        })

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.add(ws)
        rush = await self.is_rush_hour()
        await ws.send_text(json.dumps({"event": "connected", "rush_hour": rush}))

    def disconnect(self, ws: WebSocket) -> None:
        self._connections.discard(ws)

    async def broadcast(self, data: dict[str, Any]) -> None:
        dead: set[WebSocket] = set()
        payload = json.dumps(data)
        for ws in list(self._connections):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        self._connections -= dead

    async def publish(self, data: dict[str, Any]) -> None:
        if not self._redis:
            await self.broadcast(data)
            return
        try:
            await self._redis.publish(CHANNEL, json.dumps(data))
        except Exception as exc:
            log.warning("Global chat Redis publish failed: %s", exc)
            await self.broadcast(data)

    async def start_listener(self) -> None:
        if not self._redis or self._listener_task:
            return
        self._listener_task = asyncio.create_task(self._listen(), name="global_chat_listener")

    async def stop_listener(self) -> None:
        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
            self._listener_task = None

    async def _listen(self) -> None:
        assert self._redis is not None
        pubsub = self._redis.pubsub()
        await pubsub.subscribe(CHANNEL)
        try:
            async for message in pubsub.listen():
                if message.get("type") == "message":
                    try:
                        data = json.loads(message["data"])
                        await self.broadcast(data)
                    except Exception as exc:
                        log.warning("Bad global chat message: %s", exc)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            log.error("Global chat listener crashed: %s", exc)
        finally:
            try:
                await pubsub.unsubscribe(CHANNEL)
                await pubsub.aclose()
            except Exception:
                pass


global_chat_manager = GlobalChatManager()
