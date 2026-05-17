"""
Seed script: creates 15 realistic campus profiles with votes, beauty scores,
market caps, and posts so Trending Profiles has data to show.

Run from backend/ directory:
    python seed_trending.py
"""
import asyncio
import random
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Load settings
import os, sys
sys.path.insert(0, os.path.dirname(__file__))

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://campusclout:campusclout@localhost:5432/campusclout"
)

engine = create_async_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

PROFILES = [
    {"username": "alex_mit", "display_name": "Alex Chen", "bio": "CS @ MIT. Building the future one commit at a time. ☕ Coffee addict.", "domain": "mit.edu"},
    {"username": "priya_stanford", "display_name": "Priya Sharma", "bio": "Pre-med @ Stanford. Hiking & cooking enthusiast. DM for study groups!", "domain": "stanford.edu"},
    {"username": "marcus_harvard", "display_name": "Marcus Williams", "bio": "Economics major @ Harvard. Entrepreneur. Weekend chef. 🍕", "domain": "harvard.edu"},
    {"username": "zoe_nyu", "display_name": "Zoë Laurent", "bio": "Fine arts @ NYU. Paint by day, DJ by night. 🎨🎶", "domain": "nyu.edu"},
    {"username": "dev_caltech", "display_name": "Dev Patel", "bio": "Robotics PhD @ Caltech. If it moves, I built it. 🤖", "domain": "caltech.edu"},
    {"username": "luna_yale", "display_name": "Luna Rodriguez", "bio": "Political Science @ Yale. Future senator? We'll see. 🗳️", "domain": "yale.edu"},
    {"username": "zara_caltech", "display_name": "Zara Khan", "bio": "Astrophysics @ Caltech. Space nerd. Looking at stars ✨", "domain": "caltech.edu"},
    {"username": "jasper_uchicago", "display_name": "Jasper Brooks", "bio": "Philosophy & Comp Sci @ UChicago. Ask me about consciousness.", "domain": "uchicago.edu"},
    {"username": "mei_columbia", "display_name": "Mei Lin", "bio": "Architecture @ Columbia. I design spaces that feel like home 🏛️", "domain": "columbia.edu"},
    {"username": "rio_berkeley", "display_name": "Rio Santos", "bio": "Environmental Eng @ Berkeley. Save the planet first, party later. 🌱", "domain": "berkeley.edu"},
    {"username": "aisha_duke", "display_name": "Aisha Johnson", "bio": "Biomedical Eng @ Duke. Future Nobel Prize winner (manifesting). 🧬", "domain": "duke.edu"},
    {"username": "felix_upenn", "display_name": "Felix Wagner", "bio": "Wharton MBA @ UPenn. Startup founder. Let's collab! 🚀", "domain": "upenn.edu"},
    {"username": "sage_princeton", "display_name": "Sage Nakamura", "bio": "Neuroscience @ Princeton. Your brain is my canvas 🧠", "domain": "princeton.edu"},
    {"username": "iris_cornell", "display_name": "Iris Thompson", "bio": "Hotel Admin @ Cornell. Future Ritz-Carlton GM. ✈️🌍", "domain": "cornell.edu"},
    {"username": "liam_dartmouth", "display_name": "Liam O'Brien", "bio": "English Lit @ Dartmouth. Words are my superpower. 📚🖊️", "domain": "dartmouth.edu"},
]

POSTS = [
    "Just pulled an all-nighter and shipped my side project. Sleep is for the weekend! 🚀",
    "Midterms are done. Now where's my celebratory pizza? 🍕",
    "Nothing hits like a sunrise study session with good coffee ☕",
    "Campus life update: found the best hidden study spot. Not sharing it tho 😏",
    "PSA: the library printer is down again. You're welcome for the warning.",
    "Went to office hours and actually understood everything. This is peak college.",
    "Hot take: group projects would be better if I just did them alone 🤷",
    "When your research paper turns into a 3am existential crisis... classic.",
    "First day back from break. Already need another break.",
    "Made friends in the most random class and now we're inseparable 💙",
    "Reminder that everyone else is just as lost as you are. We're all figuring it out.",
    "Just discovered the campus café does a secret menu. Life. Changed.",
]


async def seed():
    from app.models.user import User
    from app.models.economy import CloutBalance
    from app.models.social import Post, ProfileVote
    from app.core.security import hash_password

    async with SessionLocal() as db:
        created_users = []

        for p in PROFILES:
            # Check if user already exists
            result = await db.execute(select(User).where(User.username == p["username"]))
            user = result.scalar_one_or_none()

            if not user:
                user = User(
                    id=uuid.uuid4(),
                    email=f"{p['username']}@{p['domain']}",
                    username=p["username"],
                    hashed_password=hash_password("Password123!"),
                    university_domain=p["domain"],
                    display_name=p["display_name"],
                    bio=p["bio"],
                    is_verified=True,
                    is_active=True,
                    hot_count=random.randint(5, 150),
                    not_count=random.randint(1, 30),
                )
                user.vote_score = float(user.hot_count - user.not_count * 0.5)
                db.add(user)
                await db.flush()

                balance = CloutBalance(
                    user_id=user.id,
                    wallet_balance=random.randint(200, 5000),
                    tokens_invested_in_me=random.randint(500, 50000),
                    market_cap=random.uniform(2000, 80000),
                    beauty_coins=random.randint(20, 500),
                )
                db.add(balance)

                # Add some posts for each user
                for content in random.sample(POSTS, k=random.randint(2, 4)):
                    post = Post(
                        id=uuid.uuid4(),
                        author_id=user.id,
                        content=content,
                        like_count=random.randint(0, 50),
                        comment_count=random.randint(0, 10),
                        is_alter_ego_post=False,
                        rank_score=random.uniform(0.1, 10.0),
                    )
                    db.add(post)

                print(f"  ✅ Created @{user.username}")
            else:
                print(f"  ⏩ @{user.username} already exists, skipping")

            created_users.append(user)

        await db.commit()
        print(f"\n✨ Seeded {len(PROFILES)} trending profiles successfully!")
        print("\nLogin credentials for any seeded user:")
        print("  Password: Password123!")
        print(f"\nExample: email={PROFILES[0]['username']}@{PROFILES[0]['domain']}")


if __name__ == "__main__":
    asyncio.run(seed())
