"""Seed test data"""
import asyncio
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings
from app.models.user import User, UserRole
from app.models.social import Post
from app.models.economy import CloutBalance
import bcrypt


async def seed():
    """Create test user and post"""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Check if test user exists
        result = await session.execute(select(User).where(User.username == "testuser"))
        user = result.scalar_one_or_none()
        
        if user:
            print("✓ Test user already exists")
        else:
            # Create test user
            user_id = uuid.uuid4()
            pwd_hash = bcrypt.hashpw(b"password123", bcrypt.gensalt()).decode()
            
            user = User(
                id=user_id,
                email="test@example.com",
                username="testuser",
                display_name="Test User",
                hashed_password=pwd_hash,
                is_active=True,
                is_verified=True,
                role=UserRole.USER,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            session.add(user)
            print("✓ Created test user")
        
        # Create clout balance for user
        result = await session.execute(select(CloutBalance).where(CloutBalance.user_id == user.id))
        balance = result.scalar_one_or_none()
        
        if not balance:
            balance = CloutBalance(
                id=uuid.uuid4(),
                user_id=user.id,
                wallet_balance=1000,
                tokens_invested_in_me=0,
                market_cap=100,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            session.add(balance)
            print("✓ Created clout balance")
        
        # Create test post
        result = await session.execute(select(Post).where(Post.author_id == user.id))
        post = result.scalar_one_or_none()
        
        if not post:
            post = Post(
                id=uuid.uuid4(),
                author_id=user.id,
                content="This is my first test post! 🎉",
                like_count=0,
                comment_count=0,
                rank_score=50,
                is_alter_ego_post=False,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            session.add(post)
            print("✓ Created test post")
        
        await session.commit()
        print("✓ Database seeded successfully!")
    
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
