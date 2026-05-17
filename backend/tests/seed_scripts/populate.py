import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import SessionLocal
from app.models.user import User
from app.models.economy import CloutBalance
from app.core.security import hash_password
import random

async def main():
    async with SessionLocal() as db:
        for i in range(1, 11):
            username = f"user_{i}"
            user = User(
                username=username,
                email=f"{username}@example.edu",
                hashed_password=hash_password("password"),
                display_name=f"Trendy User {i}",
                bio=f"This is a dummy bio for {username}. Welcome to my profile!",
                university_domain="example.edu",
                is_verified=True,
                beauty_score=random.uniform(5.0, 9.9)
            )
            db.add(user)
            await db.flush()
            
            balance = CloutBalance(
                user_id=user.id,
                wallet_balance=random.randint(100, 10000),
                tokens_invested_in_me=random.randint(500, 50000),
                market_cap=random.uniform(1000, 100000),
                beauty_coins=random.randint(10, 500)
            )
            db.add(balance)
        await db.commit()
        print("Populated dummy trending profiles!")

if __name__ == "__main__":
    asyncio.run(main())
