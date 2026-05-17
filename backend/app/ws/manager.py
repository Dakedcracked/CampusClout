"""
WebSocket connection manager with Redis pub/sub fan-out.

Flow: token_service publishes a market-cap event → Redis channel
      → listener task picks it up → broadcasts to every connected WS client.

A single global `ws_manager` instance is shared across all requests.
Redis is wired in during app startup.
"""

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect
from redis.asyncio import Redis

log = logging.getLogger(__name__)

CHANNEL = "cc:market_cap_updates"


class WebSocketManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._redis: Redis | None = None
        self._listener_task: asyncio.Task | None = None

    def wire_redis(self, redis: Redis) -> None:
        self._redis = redis

    # ------------------------------------------------------------------
    # Client lifecycle
    # ------------------------------------------------------------------

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.add(ws)
        log.debug("WS connect — total: %d", len(self._connections))

    def disconnect(self, ws: WebSocket) -> None:
        self._connections.discard(ws)
        log.debug("WS disconnect — total: %d", len(self._connections))

    # ------------------------------------------------------------------
    # Broadcast to all connected clients
    # ------------------------------------------------------------------

    async def broadcast(self, data: dict[str, Any]) -> None:
        dead: set[WebSocket] = set()
        payload = json.dumps(data)
        for ws in list(self._connections):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        self._connections -= dead

    # ------------------------------------------------------------------
    # Publish a market-cap event (called from token_service)
    # ------------------------------------------------------------------

    async def publish_market_cap_event(self, data: dict[str, Any]) -> None:
        if not self._redis:
            # No Redis — broadcast in-process only (single-instance dev mode)
            await self.broadcast(data)
            return
        try:
            await self._redis.publish(CHANNEL, json.dumps(data))
        except Exception as exc:
            log.warning("Redis publish failed: %s — falling back to local broadcast", exc)
            await self.broadcast(data)

    # ------------------------------------------------------------------
    # Redis pub/sub listener — started once at app startup
    # ------------------------------------------------------------------

    async def start_listener(self) -> None:
        if not self._redis or self._listener_task:
            return
        self._listener_task = asyncio.create_task(self._listen(), name="ws_redis_listener")
        log.info("WebSocket Redis listener started on channel '%s'", CHANNEL)

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
                    except (json.JSONDecodeError, Exception) as exc:
                        log.warning("Bad message from Redis: %s", exc)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            log.error("WS listener crashed: %s", exc)
        finally:
            try:
                await pubsub.unsubscribe(CHANNEL)
                await pubsub.aclose()
            except Exception:
                pass


ws_manager = WebSocketManager()
