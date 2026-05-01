#!/usr/bin/env python3
"""
Seed script — creates realistic demo data for CampusClout.

Run: .venv/bin/python scripts/seed.py
Idempotent: skips users that already exist.
"""
import asyncio
import json
import random
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.economy import CloutBalance, TokenTransaction, TransactionType, LoginDividend
from app.models.social import Post, PostLike, ProfileVote
from app.models.store import Storefront, Product
from app.models.user import User

USERS = [
    {"email": "alex.chen@mit.edu",    "username": "alexchen",    "display_name": "Alex Chen",    "bio": "CS junior building the next unicorn 🚀 ML researcher by day, hacker by night.", "hot": 42, "not_": 3},
    {"email": "priya.k@stanford.edu", "username": "priyak",      "display_name": "Priya K",      "bio": "Pre-med meets philosophy. Figuring out how to save the world one decision at a time.", "hot": 38, "not_": 5},
    {"email": "jamie.r@harvard.edu",  "username": "jamier",       "display_name": "Jamie R",      "bio": "Economics + poker. I understand incentives better than most 😏", "hot": 55, "not_": 8},
    {"email": "zara.m@caltech.edu",   "username": "zaram",        "display_name": "Zara M",       "bio": "Astrophysics PhD. If you can see the stars, I can tell you everything about them.", "hot": 61, "not_": 4},
    {"email": "kai.t@nyu.edu",        "username": "kait",         "display_name": "Kai T",        "bio": "Film director, amateur chef, professional overthinker. Let's create something.", "hot": 29, "not_": 12},
    {"email": "sofia.v@columbia.edu", "username": "sofiav",       "display_name": "Sofia V",      "bio": "Environmental law student. Fighting for the planet, one brief at a time 🌍", "hot": 47, "not_": 6},
    {"email": "marcus.j@upenn.edu",   "username": "marcusj",      "display_name": "Marcus J",     "bio": "Wharton MBA candidate. Business plan in my head, gym schedule in my hands.", "hot": 33, "not_": 9},
    {"email": "luna.x@yale.edu",      "username": "lunax",        "display_name": "Luna X",       "bio": "Fine arts + computer science. I make things that make you feel things.", "hot": 58, "not_": 2},
    {"email": "dev.s@cornell.edu",    "username": "devs",         "display_name": "Dev S",        "bio": "Robotics + coffee. Probably thinking about servo motors right now.", "hot": 24, "not_": 7},
    {"email": "maya.o@brown.edu",     "username": "mayao",        "display_name": "Maya O",       "bio": "Cognitive science junior. Your brain is fascinating, especially to me.", "hot": 44, "not_": 3},
]

POSTS = [
    "Just pushed my first ML model to prod. It's only 73% accurate but hey, that's better than most people 😂",
    "Reminder that 8am classes are a form of academic hazing and we should talk about this more",
    "The library is packed at 2am and I'm weirdly proud of everyone here. We're all suffering together 💪",
    "Someone in my dorm cooked fish at midnight AGAIN. We need a reckoning.",
    "Finals week energy: 40% panic, 30% caffeine, 20% denial, 10% somehow confident",
    "Hot take: office hours are the most underutilized resource in college. Use them.",
    "Just got my market cap to 1200. Starting to feel like a campus celebrity 📈",
    "Wrote 6000 words in 4 hours. Don't know if they're good words. They're words.",
    "Every group project has: the one who does everything, the one who disappears, and the one who shows up at the end. Which one are you?",
    "Study tip: the Pomodoro technique hits different after midnight",
    "Campus dining just served something they called 'protein bowl' and I've never been more philosophically unsettled",
    "The amount of startup ideas born in dining halls that never get built could have changed the world",
    "Your market cap is a reflection of how much people believe in you. That's either inspiring or terrifying.",
    "Shoutout to everyone who submitted assignments at 11:58pm. We are cut from the same cloth.",
    "Just discovered that the vending machine in the engineering building gives double snacks if you push E7 twice. This information is free.",
    "Investment thesis: invest in people before they get famous. The returns are emotional.",
    "My GPA and my social life are in a zero-sum game and honestly social life is winning this semester",
    "There's something beautiful about 3000 people all struggling toward the same impossible standard together",
    "Dropped my laptop and watched my entire semester flash before my eyes. It's fine. Everything's fine.",
    "The most honest CV line I could write: 'survived on chaos and determination'",
]

STORE_CATALOG = [
    # Notes & Academic
    ("CS 6.046 Algorithm Notes", "Complete handwritten + typed notes for the semester. All problem sets included. Tested — these got me an A.", 45, 50),
    ("Organic Chemistry Survival Pack", "Reaction mechanism flashcards (200+), mnemonics, and the study schedule that actually works.", 35, 30),
    ("Economics 101 Lecture Summaries", "Every lecture condensed to 1 page. Perfect for finals cram sessions.", 25, 100),
    ("Linear Algebra Visual Guide", "Color-coded visual explanations. If textbooks confuse you, this won't.", 30, 40),
    ("LSAT Prep Bundle", "6 months of practice questions, timing strategies, and personal score improvement notes.", 80, 20),

    # Lifestyle & Campus
    ("Campus Coffee Tasting Guide", "Ranked every coffee spot within 2 miles. Includes hidden gems and off-menu orders.", 8, 200),
    ("Dorm Room Aesthetic Kit", "Plant care guide + DIY decoration ideas that actually look good in 120 sq ft.", 15, 75),
    ("Campus Social Playbook", "How to make friends in college without being awkward. Real tactics that worked for me.", 20, 60),
    ("Late Night Delivery Tier List", "Every delivery option ranked by price, speed, and post-midnight reliability.", 5, -1),
    ("Thrift Store Campus Map", "Best thrift shops near 10 major universities, with days they restock.", 12, -1),

    # Skills & Professional
    ("Figma Design Crash Course", "Go from zero to portfolio-ready in a weekend. 3 full project walkthroughs included.", 40, 25),
    ("Cold Email Templates That Work", "15 templates I used to land internships at 3 FAANG companies. Personalisation tips included.", 55, -1),
    ("Python for Non-Programmers", "Learn enough Python in a week to automate your life. No CS background needed.", 35, 45),
    ("Interview Prep: Behavioral Questions", "STAR-method answers for 50 common questions. Tailored for campus recruiting.", 30, -1),
    ("Startup Pitch Deck Template", "Canva template + fill-in guide. Got me through 2 pitch competitions.", 25, 35),

    # Wellness & Fitness
    ("Dorm Room Workout Plan", "No gym needed. 4-week program using only bodyweight. Progress photos optional.", 18, -1),
    ("Student Budget Meal Prep Guide", "28 meals for under $40. Full grocery list, prep times, and macros.", 15, -1),
    ("Mental Health Toolkit for Students", "Practical strategies for managing stress, anxiety, and academic pressure. Evidence-based.", 20, -1),
    ("Sleep Optimization for Students", "Fixing your sleep on a college schedule. Includes nap science and exam-day timing.", 12, -1),

    # Creative & Fun
    ("Campus Photography Spots Map", "40 best photo locations on and around campus. Best lighting times included.", 10, -1),
    ("Club & Event Networking Guide", "How to actually make connections at campus events without it being cringe.", 15, -1),
    ("Playlist Curation Service", "Send me your vibe — I'll build you a 2-hour study playlist.", 8, 50),
    ("Handmade Friendship Bracelet", "Custom colors. Made with care. Ships on campus.", 12, 20),
    ("Campus Relationship Advice Session", "30 min anonymous chat about campus relationship dynamics. Non-judgmental.", 10, 15),
]


async def seed():
    async with AsyncSessionLocal() as db:
        created_users = []

        for u in USERS:
            existing = await db.execute(select(User).where(User.username == u["username"]))
            if existing.scalar_one_or_none():
                print(f"  skip {u['username']} (exists)")
                existing_full = await db.execute(
                    select(User).where(User.username == u["username"])
                )
                created_users.append(existing_full.scalar_one())
                continue

            now = datetime.now(timezone.utc)
            user = User(
                email=u["email"],
                username=u["username"],
                hashed_password=hash_password("CampusPass123!"),
                university_domain=u["email"].split("@")[1],
                display_name=u["display_name"],
                bio=u["bio"],
                is_verified=True,
                is_active=True,
                last_active_at=now - timedelta(hours=random.randint(0, 48)),
                hot_count=u["hot"],
                not_count=u["not_"],
                vote_score=float(u["hot"] - u["not_"] * 0.5),
            )
            db.add(user)
            await db.flush()

            wallet = random.randint(80, 400)
            invested_in = random.randint(50, 800)
            cap = round(invested_in * random.uniform(1.0, 1.95), 2)

            balance = CloutBalance(
                user_id=user.id,
                wallet_balance=wallet,
                tokens_invested_in_me=invested_in,
                market_cap=cap,
                market_cap_updated_at=now,
                beauty_coins=random.randint(0, 200),
            )
            db.add(balance)

            mint = TokenTransaction(
                from_user_id=None,
                to_user_id=user.id,
                amount=100,
                transaction_type=TransactionType.MINT,
                note="Signup bonus",
            )
            db.add(mint)

            created_users.append(user)
            print(f"  created @{user.username} (cap={cap})")

        await db.commit()

        # Refresh user list with IDs
        user_ids = {u.username: u.id for u in created_users}

        # Posts
        for user in created_users:
            for _ in range(random.randint(2, 5)):
                content = random.choice(POSTS)
                likes = random.randint(0, 30)
                daysago = random.randint(0, 14)
                import math
                cap_val = 500.0
                age_h = daysago * 24
                rank = math.log10(max(cap_val, 1) + 1) / (1 + age_h * 0.1) * (1 + likes * 0.1)
                post = Post(
                    author_id=user.id,
                    content=content,
                    like_count=likes,
                    rank_score=round(rank, 4),
                    is_alter_ego_post=False,
                )
                post.created_at = datetime.now(timezone.utc) - timedelta(days=daysago, hours=random.randint(0, 23))
                db.add(post)

        await db.commit()
        print(f"  posts seeded")

        # Storefronts & Products — first 6 users get stores
        store_users = created_users[:6]
        products_added = 0
        for i, user in enumerate(store_users):
            existing_sf = await db.execute(
                select(Storefront).where(Storefront.owner_id == user.id)
            )
            if existing_sf.scalar_one_or_none():
                continue

            sf = Storefront(
                owner_id=user.id,
                name=f"{user.display_name}'s Shop",
                description=f"Exclusive resources and services from @{user.username}. Quality guaranteed.",
                is_active=True,
                total_sales_volume=random.randint(0, 150),
            )
            db.add(sf)
            await db.flush()

            # Give each store 3-5 products from catalog
            catalog_slice = STORE_CATALOG[i * 4:(i * 4) + random.randint(3, 5)]
            for name, desc, price, stock in catalog_slice:
                prod = Product(
                    storefront_id=sf.id,
                    name=name,
                    description=desc,
                    base_price=price,
                    stock_count=stock,
                    is_active=True,
                    total_sold=random.randint(0, 20),
                )
                db.add(prod)
                products_added += 1

        await db.commit()
        print(f"  {products_added} products across {len(store_users)} stores")

        # Profile votes between users
        votes_added = 0
        for voter in created_users:
            targets = [u for u in created_users if u.id != voter.id]
            to_vote = random.sample(targets, min(4, len(targets)))
            for target in to_vote:
                existing_v = await db.execute(
                    select(ProfileVote).where(
                        ProfileVote.voter_id == voter.id,
                        ProfileVote.target_id == target.id,
                    )
                )
                if existing_v.scalar_one_or_none():
                    continue
                vtype = "hot" if random.random() < 0.75 else "not"
                pv = ProfileVote(voter_id=voter.id, target_id=target.id, vote_type=vtype)
                db.add(pv)
                votes_added += 1

        await db.commit()
        print(f"  {votes_added} profile votes seeded")

        print("\n  Demo credentials (all passwords: CampusPass123!)")
        for u in USERS:
            print(f"    {u['email']}")


if __name__ == "__main__":
    asyncio.run(seed())
