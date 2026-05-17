import asyncio
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.core.config import settings
from app.models.user import User, UserRole
from app.models.economy import CloutBalance

engine = create_async_engine(str(settings.DATABASE_URL))
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

PREMIUM_PROFILES = [
    {
        "username": "chloe_nyc",
        "display_name": "Chloe ✨",
        "avatar_url": "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80",
        "bio": "Fashion & Finance. NYC -> Campus. Tell me your highest holding.",
        "beauty_score": 9.8,
        "cap": 55000,
        "hot_count": 8900,
    },
    {
        "username": "nathan_x",
        "display_name": "Nate",
        "avatar_url": "https://images.unsplash.com/photo-1488161628813-044c5f9cb4db?w=800&q=80",
        "bio": "D1. Not checking this often, snap me if you have clout.",
        "beauty_score": 9.4,
        "cap": 42000,
        "hot_count": 5200,
    },
    {
        "username": "isabella.xo",
        "display_name": "Izzy 🖤",
        "avatar_url": "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&q=80",
        "bio": "Swipe hot if your wallet is >10k.",
        "beauty_score": 9.9,
        "cap": 85000,
        "hot_count": 12400,
    },
    {
        "username": "liam_beats",
        "display_name": "Liam",
        "avatar_url": "https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=800&q=80",
        "bio": "Producer. Looking for a muse. 🎹",
        "beauty_score": 8.9,
        "cap": 18000,
        "hot_count": 3100,
    },
    {
        "username": "mia.styles",
        "display_name": "Mia",
        "avatar_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80",
        "bio": "Art & architecture. Coffee dates only.",
        "beauty_score": 9.5,
        "cap": 62000,
        "hot_count": 7800,
    }
]

async def seed_profiles():
    async with async_session() as db:
        for p in PREMIUM_PROFILES:
            import sqlalchemy as sa
            result = await db.execute(sa.select(User).where(User.username == p["username"]))
            if result.scalar_one_or_none():
                print(f"Skipping {p['username']}, already exists.")
                continue

            user = User(
                id=uuid.uuid4(),
                email=f"{p['username']}@campus.edu",
                username=p["username"],
                hashed_password="dummy_hash_for_bot",
                university_domain="campus.edu",
                is_verified=True,
                display_name=p["display_name"],
                bio=p["bio"],
                avatar_url=p["avatar_url"],
                hot_count=p["hot_count"],
                not_count=int(p["hot_count"] * 0.05), # High hot ratio
                vote_score=float(p["hot_count"]),
                attractiveness_percentage=p["beauty_score"] * 10,
                last_active_at=datetime.now(timezone.utc),
            )
            db.add(user)
            
            balance = CloutBalance(
                user_id=user.id,
                wallet_balance=p["cap"],
                market_cap=p["cap"],
            )
            db.add(balance)

        await db.commit()
        print("Successfully seeded premium trending honeypots!")

if __name__ == "__main__":
    asyncio.run(seed_profiles())
