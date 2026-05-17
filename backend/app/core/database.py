from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.core.config import settings

# Configure engine based on database type
engine_kwargs = {
    "echo": settings.DEBUG,
}

# Production configuration for PostgreSQL
if "postgresql" in settings.DATABASE_URL:
    engine_kwargs.update({
        # Connection health checking: verify connections before using
        "pool_pre_ping": True,
        
        # Pool size: how many connections to maintain in pool
        # Default: 30 connections per app instance
        "pool_size": getattr(settings, "DB_POOL_SIZE", 30),
        
        # Max overflow: additional connections when pool exhausted
        # Default: 10 extra connections
        "max_overflow": getattr(settings, "DB_MAX_OVERFLOW", 10),
        
        # Recycle: refresh connections every N seconds (prevent stale connections)
        # Default: 3600 seconds (1 hour)
        "pool_recycle": getattr(settings, "DB_POOL_RECYCLE", 3600),
        
        # Connection arguments for PostgreSQL
        "connect_args": {
            "server_settings": {
                "application_name": "campusclout_api",
                "jit": "off",  # Disable JIT compilation for consistency
            },
            "timeout": 30,  # 30 second connection timeout
            "command_timeout": 30,  # 30 second command timeout
        },
    })
    
    print("[DATABASE] Configured PostgreSQL with:")
    print(f"  - Pool size: {engine_kwargs['pool_size']}")
    print(f"  - Max overflow: {engine_kwargs['max_overflow']}")
    print(f"  - Pool recycle: {engine_kwargs['pool_recycle']}s")
    
else:
    # SQLite for development (doesn't support pooling)
    engine_kwargs.update({
        "connect_args": {"timeout": 30, "check_same_thread": False},
    })
    print("[DATABASE] Using SQLite (development mode)")

engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Alias used by background tasks that need to create their own sessions
async_session_factory = AsyncSessionLocal


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def close_db():
    """Close database connections on shutdown."""
    await engine.dispose()
