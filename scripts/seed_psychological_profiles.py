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

# The 3 Psychological Archetypes of Engagement
PSYCHOLOGICAL_PROFILES = [
    # 1. The Aspirational Archetype (Status Envy / Lust)
    # Designed to be locked behind the "Frosted Glass" paywall to drain tokens.
    {
        "username": "victoria.secret",
        "display_name": "Victoria 💎",
        "avatar_url": "https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?w=800&q=80",
        "bio": "Pre-med. Only here for the highest bidder. 📈",
        "beauty_score": 9.9,
        "cap": 125000,
        "hot_count": 25000,
        "not_count": 500,
    },
    {
        "username": "chase_finance",
        "display_name": "Chase",
        "avatar_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80",
        "bio": "IB intern. Looking for someone who understands compound interest.",
        "beauty_score": 9.2,
        "cap": 95000,
        "hot_count": 18000,
        "not_count": 1200,
    },
    
    # 2. The Attainable Archetype (The Conversion Driver)
    # Designed to be just attractive enough, but with a low enough cap that average users feel confident DMing them (burning 5-10 tokens).
    {
        "username": "emily_reads",
        "display_name": "Emily 📚",
        "avatar_url": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=800&q=80",
        "bio": "English major. I probably like your dog more than you.",
        "beauty_score": 7.5,
        "cap": 4500,
        "hot_count": 1200,
        "not_count": 300,
    },
    {
        "username": "lucas_games",
        "display_name": "Lucas",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
        "bio": "CS. Super Smash Bros champion of my dorm.",
        "beauty_score": 7.2,
        "cap": 3800,
        "hot_count": 850,
        "not_count": 200,
    },

    # 3. The Polarizing Archetype (Outrage Engagement)
    # Designed to generate a massive amount of "Not" swipes or angry DMs. 
    # In a social stock market, even hate-engagement is engagement.
    {
        "username": "frat_god_chad",
        "display_name": "Chad 🏈",
        "avatar_url": "https://images.unsplash.com/photo-1517070208541-6ddc4d3efbcb?w=800&q=80",
        "bio": "If you don't go to the gym 6 days a week, swipe Not. Don't waste my time.",
        "beauty_score": 8.5,
        "cap": 32000,
        "hot_count": 5000,
        "not_count": 12000, # Massive negative engagement
    },
    {
        "username": "mean_girl_lexi",
        "display_name": "Lexi",
        "avatar_url": "https://images.unsplash.com/photo-1464863979621-258859e62245?w=800&q=80",
        "bio": "I literally only reply if your cap is over 50k. Sorry not sorry.",
        "beauty_score": 8.8,
        "cap": 48000,
        "hot_count": 6000,
        "not_count": 9000,
    }
]

async def seed_profiles():
    async with async_session() as db:
        for p in PSYCHOLOGICAL_PROFILES:
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
                not_count=p["not_count"],
                vote_score=float(p["hot_count"] - p["not_count"]),
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
        print("Successfully seeded psychological archetypes!")

if __name__ == "__main__":
    asyncio.run(seed_profiles())
