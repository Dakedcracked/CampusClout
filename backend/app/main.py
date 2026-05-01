import asyncio
from contextlib import asynccontextmanager

import os as _os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.redis_client import close_redis, get_redis
from app.api.v1.router import api_router
from app.ws.manager import ws_manager
from app.ws.chat_manager import chat_manager
from app.ws.global_manager import global_chat_manager
from app.ws.room_manager import room_manager
from app.services.idle_monitor import idle_monitor_task
from app.tasks.scheduler import setup_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    idle_task = None
    scheduler = setup_scheduler()
    try:
        redis = await get_redis()
        app.state.redis = redis
        ws_manager.wire_redis(redis)
        chat_manager.wire_redis(redis)
        global_chat_manager.wire_redis(redis)
        room_manager.wire_redis(redis)
        await ws_manager.start_listener()
        await global_chat_manager.start_listener()
    except Exception as exc:
        app.state.redis = None
        print(f"[WARNING] Redis unavailable at startup: {exc}. Rate limiting + WS pub/sub disabled.")

    idle_task = asyncio.create_task(idle_monitor_task(), name="idle_monitor")
    scheduler.start()

    yield

    scheduler.shutdown(wait=False)
    if idle_task:
        idle_task.cancel()
        try:
            await idle_task
        except asyncio.CancelledError:
            pass
    await ws_manager.stop_listener()
    await global_chat_manager.stop_listener()
    await close_redis()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_static_dir = _os.path.join(_os.path.dirname(__file__), "..", "static")
_os.makedirs(_os.path.join(_static_dir, "uploads"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_os.path.join(_static_dir, "uploads")), name="static")

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["meta"])
async def health():
    return {
        "status": "ok",
        "version": settings.APP_VERSION,
        "redis": app.state.redis is not None,
    }
