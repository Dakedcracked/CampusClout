#!/usr/bin/env python
"""Initialize database and run migrations."""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import engine, Base
from app.models.user import User  # noqa
from app.models.social_feed import Post, Like, Comment  # noqa
from app.models.chat import ChatThread, ChatMessage  # noqa
from app.models.storefront import StorefrontProduct, Order  # noqa
from app.models.market_engine import MarketListing, Transaction  # noqa
from app.models.global_chat import GlobalChatMessage, GlobalChatThread  # noqa
from app.models.ai_companion import AICompanion, AIMessage  # noqa


async def init_db():
    """Create all tables in the database."""
    try:
        print("🔄 Creating database tables...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ Database tables created successfully!")
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(init_db())
