import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

junk_files = [
    "debug_seed.py",
    "test_post.py",
    "backend.log",
    "dump_posts.py",
    "check_posts.py",
    "populate.py"
]

for f in junk_files:
    try:
        os.remove(f)
        print(f"Removed {f}")
    except OSError:
        pass

async def upgrade_db():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        print("Running manual DB migration...")
        
        # post_comments changes
        await conn.execute(text("ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES post_comments(id) ON DELETE CASCADE;"))
        await conn.execute(text("ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0;"))
        await conn.execute(text("ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_post_comments_parent_id ON post_comments(parent_id);"))
        
        # post_shares
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS post_shares (
                id UUID PRIMARY KEY,
                post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
            );
        """))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_post_shares_post_id ON post_shares(post_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_post_shares_user_id ON post_shares(user_id);"))
        
        # user_behaviors
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS user_behaviors (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                event_type VARCHAR(64) NOT NULL,
                target_id VARCHAR(128),
                metadata_json TEXT,
                session_id VARCHAR(64),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
            );
        """))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_behaviors_user_id ON user_behaviors(user_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_behaviors_event_type ON user_behaviors(event_type);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_behaviors_created_at ON user_behaviors(created_at);"))
        
        # daily_streaks
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS daily_streaks (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                current_streak INTEGER NOT NULL DEFAULT 0,
                longest_streak INTEGER NOT NULL DEFAULT 0,
                last_checkin_date DATE,
                total_checkins INTEGER NOT NULL DEFAULT 0,
                CONSTRAINT uq_streak_user UNIQUE(user_id)
            );
        """))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_daily_streaks_user_id ON daily_streaks(user_id);"))

        # Performance Indexes
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_posts_author_created ON posts(author_id, created_at);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_posts_rank_score ON posts(rank_score DESC);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_id, is_read, created_at DESC);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_user_behaviors_user_event ON user_behaviors(user_id, event_type, created_at DESC);"))
        
        print("Done!")

if __name__ == "__main__":
    asyncio.run(upgrade_db())
