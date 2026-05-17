import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import SessionLocal
from app.models.social import Post
from sqlalchemy import select

async def check():
    async with SessionLocal() as db:
        res = await db.execute(select(Post).order_by(Post.created_at.desc()))
        posts = res.scalars().all()
        print(f"Found {len(posts)} posts:")
        for p in posts:
            print(f"- {p.id}: {p.content} (Author: {p.author_id})")

if __name__ == "__main__":
    asyncio.run(check())
