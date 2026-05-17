"""Create SQLite database with schema from models"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings
from app.models.base import Base


async def create_db():
    """Create all tables in SQLite"""
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
    )
    
    # Import all models to register them
    from app import models
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    await engine.dispose()
    print("✓ Database created successfully!")

if __name__ == "__main__":
    asyncio.run(create_db())
