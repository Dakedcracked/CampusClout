"""
Room chat WebSocket manager.

Tracks per-room connections so messages are delivered only to room members.
Uses Redis pub/sub (channel cc:room:{room_id}) for distributed connection
management across multiple API instances.
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Any

from fastapi import WebSocket
from redis.asyncio import Redis

from app.models.user import User

log = logging.getLogger(__name__)


class RoomConnectionManager:
    def __init__(self) -> None:
        # room_id → list of (user_id, username, websocket)
        self._rooms: dict[str, list[tuple[str, str, WebSocket]]] = {}
        self._redis: Redis | None = None
        self._listener_tasks: dict[str, asyncio.Task] = {}

    def wire_redis(self, redis: Redis) -> None:
        self._redis = redis

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    async def connect(self, room_id: str, user: User, ws: WebSocket) -> None:
        """Add new connection to room."""
        await ws.accept()
        user_id = str(user.id)
        username = user.username
        self._rooms.setdefault(room_id, []).append((user_id, username, ws))

        # Start listener if not already running
        if self._redis and room_id not in self._listener_tasks:
            task = asyncio.create_task(
                self._listen(room_id), name=f"room_listener_{room_id}"
            )
            self._listener_tasks[room_id] = task

        log.debug("Room connect room=%s user=%s username=%s", room_id, user_id, username)

        # Broadcast member joined event
        await self.broadcast_member_joined(room_id, user)

    def disconnect(self, room_id: str, user_id: str, ws: WebSocket) -> None:
        """Remove connection from room."""
        if room_id in self._rooms:
            self._rooms[room_id] = [
                (u_id, uname, w) for u_id, uname, w in self._rooms[room_id] if w is not ws
            ]
            if not self._rooms[room_id]:
                del self._rooms[room_id]
                task = self._listener_tasks.pop(room_id, None)
                if task:
                    task.cancel()

        log.debug("Room disconnect room=%s user=%s", room_id, user_id)

    def has_connections(self, room_id: str) -> bool:
        """Check if room has active connections."""
        return bool(self._rooms.get(room_id))

    def get_room_member_count(self, room_id: str) -> int:
        """Count active connections in room."""
        return len(self._rooms.get(room_id, []))

    # ------------------------------------------------------------------
    # Broadcast to all room members
    # ------------------------------------------------------------------

    async def broadcast_message(self, room_id: str, message: dict[str, Any]) -> None:
        """Send message to all users in room."""
        dead: list[tuple[str, str, WebSocket]] = []
        payload = json.dumps(message, default=str)
        for triple in list(self._rooms.get(room_id, [])):
            try:
                await triple[2].send_text(payload)
            except Exception:
                dead.append(triple)
        if dead and room_id in self._rooms:
            self._rooms[room_id] = [t for t in self._rooms[room_id] if t not in dead]

    async def broadcast_member_joined(self, room_id: str, user: User) -> None:
        """Notify room of new member."""
        message = {
            "type": "member_joined",
            "user_id": str(user.id),
            "username": user.username,
            "timestamp": datetime.utcnow().isoformat(),
        }
        await self.publish(room_id, message)

    async def broadcast_member_left(self, room_id: str, user_id: str, username: str) -> None:
        """Notify room of member departure."""
        message = {
            "type": "member_left",
            "user_id": user_id,
            "username": username,
            "timestamp": None,
        }
        await self.publish(room_id, message)

    async def publish(self, room_id: str, data: dict[str, Any]) -> None:
        """Publish message via Redis pub/sub or broadcast locally."""
        if not self._redis:
            await self.broadcast_message(room_id, data)
            return
        channel = f"cc:room:{room_id}"
        try:
            await self._redis.publish(channel, json.dumps(data, default=str))
        except Exception as exc:
            log.warning("Room Redis publish failed: %s", exc)
            await self.broadcast_message(room_id, data)

    # ------------------------------------------------------------------
    # Redis pub/sub listener per active room
    # ------------------------------------------------------------------

    async def _listen(self, room_id: str) -> None:
        """Listen for room messages from Redis pub/sub."""
        assert self._redis is not None
        channel = f"cc:room:{room_id}"
        pubsub = self._redis.pubsub()
        await pubsub.subscribe(channel)
        try:
            async for message in pubsub.listen():
                if message.get("type") == "message":
                    try:
                        data = json.loads(message["data"])
                        await self.broadcast_message(room_id, data)
                    except Exception as exc:
                        log.warning("Bad room message: %s", exc)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            log.error("Room listener crashed: %s", exc)
        finally:
            try:
                await pubsub.unsubscribe(channel)
                await pubsub.aclose()
            except Exception:
                pass


room_manager = RoomConnectionManager()
