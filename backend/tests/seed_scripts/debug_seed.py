import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.core.security import hash_password
from datetime import datetime, timezone

async def debug_db():
    async with AsyncSessionLocal() as db:
        try:
            print("Creating user...")
            u = User(
                email="test.debug@mit.edu",
                username="testdebug",
                hashed_password=hash_password("test"),
                university_domain="mit.edu",
                display_name="Test",
                is_verified=True,
                is_active=True,
                hot_count=0,
                not_count=0,
                vote_score=0.0
            )
            db.add(u)
            await db.flush()
            print("User created successfully!")
            await db.rollback()
        except Exception as e:
            print(f"ERROR: {type(e)}")
            print(f"Exception details: {e}")

if __name__ == "__main__":
    asyncio.run(debug_db())
