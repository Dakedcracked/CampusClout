import asyncio
from contextlib import asynccontextmanager

import os as _os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from app.middleware.security_headers import SecurityHeadersMiddleware

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
    allow_origins=settings.all_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],  # Explicit methods for production
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],  # Only necessary headers
    expose_headers=["Set-Cookie"],
    max_age=3600,  # Cache preflight for 1 hour
)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(SecurityHeadersMiddleware)

_static_dir = _os.path.join(_os.path.dirname(__file__), "..", "static")
_os.makedirs(_os.path.join(_static_dir, "uploads"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_os.path.join(_static_dir, "uploads")), name="static")

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["meta"])
async def health():
    """
    Comprehensive health check for production monitoring.
    Returns status of application, database, and cache.
    """
    status_info = {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "environment": getattr(settings, "ENVIRONMENT", "unknown"),
    }
    
    # Check database
    try:
        from app.core.database import engine
        from sqlalchemy import text
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1;"))
        status_info["database"] = "connected"
    except Exception as e:
        status_info["database"] = f"error: {str(e)[:50]}"
        status_info["status"] = "degraded"
    
    # Check Redis
    status_info["redis"] = "connected" if app.state.redis is not None else "disconnected"
    if app.state.redis is None:
        status_info["status"] = "degraded"
    
    # Check pool statistics (PostgreSQL only)
    from app.core.database import engine
    if engine.pool is not None and hasattr(engine.pool, "size"):
        status_info["pool"] = {
            "size": engine.pool.size(),
            "checked_out": engine.pool.checkedout(),
            "overflow": engine.pool.overflow() if hasattr(engine.pool, "overflow") else 0,
        }
    
    # Return appropriate status code
    import json
    if status_info["status"] == "healthy":
        return status_info
    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail=status_info)


