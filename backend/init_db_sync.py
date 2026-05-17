#!/usr/bin/env python3
"""Synchronous database initialization script for production startup."""

import os
import sys
import sqlite3
from pathlib import Path

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

# Import all models to register them with Base
from app.models.user import User  # noqa
from app.models.social_feed import Post, Like, Comment  # noqa
from app.models.chat import ChatThread, ChatMessage  # noqa
from app.models.storefront import StorefrontProduct, Order  # noqa
from app.models.market_engine import MarketListing, Transaction  # noqa
from app.models.global_chat import GlobalChatMessage, GlobalChatThread  # noqa
from app.models.ai_companion import AICompanion, AIMessage  # noqa
from app.core.database import Base
from sqlalchemy import create_engine, inspect

def init_db_sync():
    """Initialize database tables synchronously."""
    db_path = os.getenv("DATABASE_URL", "sqlite:///./app.db").replace("sqlite+aiosqlite:///", "")
    
    try:
        print(f"📦 Initializing database at {db_path}...")
        
        # Use synchronous engine for init
        engine = create_engine(f"sqlite:///{db_path}" if not db_path.startswith("/") else f"sqlite:///{db_path}")
        
        # Check existing tables
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        
        if existing_tables:
            print(f"✅ Database already has tables: {', '.join(existing_tables)}")
            return
        
        # Create all tables
        Base.metadata.create_all(engine)
        print("✅ All database tables created successfully!")
        
    except Exception as e:
        print(f"⚠️  Database initialization error (non-fatal): {e}")
        # Don't exit - app will handle missing tables gracefully


if __name__ == "__main__":
    init_db_sync()
