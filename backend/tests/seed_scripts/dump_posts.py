import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

async def run():
    engine = create_async_engine("postgresql+asyncpg://campusclout:campusclout@localhost:5432/campusclout")
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        result = await session.execute(text("SELECT id, content, created_at, author_id FROM posts ORDER BY created_at DESC LIMIT 10;"))
        posts = result.fetchall()
        
        with open("/home/aditya/Desktop/Sau-statup/backend/db_dump.txt", "w") as f:
            f.write(f"Found {len(posts)} posts\n")
            for p in posts:
                f.write(f"{p.id} | {p.content} | {p.created_at} | {p.author_id}\n")

if __name__ == "__main__":
    asyncio.run(run())
