"""Clubs — Discord-style campus groups."""
import re
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clubs import Club, ClubMember, ClubMessage
from app.models.user import User


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower().strip())
    return slug.strip("-")[:80]


async def create_club(db: AsyncSession, user_id: uuid.UUID, name: str, description: str | None, icon_emoji: str, is_public: bool) -> dict:
    slug = _slugify(name)
    existing = await db.execute(select(Club).where(Club.slug == slug))
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"A club with slug '{slug}' already exists")

    club = Club(
        name=name.strip()[:80],
        slug=slug,
        description=description,
        icon_emoji=icon_emoji or "🎓",
        owner_id=user_id,
        member_count=1,
        is_public=is_public,
        created_at=datetime.now(timezone.utc),
    )
    db.add(club)
    await db.flush()

    member = ClubMember(club_id=club.id, user_id=user_id, role="owner", joined_at=datetime.now(timezone.utc))
    db.add(member)
    await db.commit()
    await db.refresh(club)
    return _club_dict(club, "owner")


async def list_clubs(db: AsyncSession, search: str | None = None, limit: int = 50) -> list[dict]:
    q = select(Club).where(Club.is_public == True).order_by(Club.member_count.desc()).limit(limit)
    if search:
        q = q.where(Club.name.ilike(f"%{search}%"))
    result = await db.execute(q)
    clubs = result.scalars().all()
    return [_club_dict(c) for c in clubs]


async def get_club(db: AsyncSession, slug: str, user_id: uuid.UUID | None = None) -> dict:
    result = await db.execute(select(Club).where(Club.slug == slug))
    club = result.scalar_one_or_none()
    if not club:
        raise HTTPException(404, "Club not found")
    role = None
    if user_id:
        mr = await db.execute(select(ClubMember).where(ClubMember.club_id == club.id, ClubMember.user_id == user_id))
        m = mr.scalar_one_or_none()
        role = m.role if m else None
    return _club_dict(club, role)


async def join_club(db: AsyncSession, user_id: uuid.UUID, slug: str) -> dict:
    result = await db.execute(select(Club).where(Club.slug == slug))
    club = result.scalar_one_or_none()
    if not club:
        raise HTTPException(404, "Club not found")
    existing = await db.execute(select(ClubMember).where(ClubMember.club_id == club.id, ClubMember.user_id == user_id))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Already a member")
    member = ClubMember(club_id=club.id, user_id=user_id, role="member", joined_at=datetime.now(timezone.utc))
    db.add(member)
    club.member_count = (club.member_count or 0) + 1
    await db.commit()
    return {"joined": True, "member_count": club.member_count}


async def leave_club(db: AsyncSession, user_id: uuid.UUID, slug: str) -> dict:
    result = await db.execute(select(Club).where(Club.slug == slug))
    club = result.scalar_one_or_none()
    if not club:
        raise HTTPException(404, "Club not found")
    if club.owner_id == user_id:
        raise HTTPException(400, "Owner cannot leave — transfer ownership first")
    mr = await db.execute(select(ClubMember).where(ClubMember.club_id == club.id, ClubMember.user_id == user_id))
    m = mr.scalar_one_or_none()
    if not m:
        raise HTTPException(400, "Not a member")
    db.delete(m)
    club.member_count = max(0, (club.member_count or 1) - 1)
    await db.commit()
    return {"left": True, "member_count": club.member_count}


async def get_my_clubs(db: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    result = await db.execute(
        select(Club).join(ClubMember, ClubMember.club_id == Club.id).where(ClubMember.user_id == user_id).order_by(Club.member_count.desc())
    )
    return [_club_dict(c) for c in result.scalars().all()]


async def get_club_messages(db: AsyncSession, slug: str, user_id: uuid.UUID, limit: int = 50) -> list[dict]:
    club_r = await db.execute(select(Club).where(Club.slug == slug))
    club = club_r.scalar_one_or_none()
    if not club:
        raise HTTPException(404, "Club not found")
    # Check membership for private clubs
    if not club.is_public:
        mr = await db.execute(select(ClubMember).where(ClubMember.club_id == club.id, ClubMember.user_id == user_id))
        if not mr.scalar_one_or_none():
            raise HTTPException(403, "Join the club to view messages")

    result = await db.execute(
        select(ClubMessage, User).join(User, User.id == ClubMessage.sender_id, isouter=True)
        .where(ClubMessage.club_id == club.id)
        .order_by(ClubMessage.created_at.asc())
        .limit(limit)
    )
    rows = result.all()
    return [
        {
            "id": str(msg.id),
            "content": msg.content,
            "media_url": msg.media_url,
            "media_type": msg.media_type,
            "sender": u.username if u else "deleted",
            "sender_display": u.display_name if u else None,
            "sender_avatar": u.avatar_url if u else None,
            "created_at": msg.created_at.isoformat(),
        }
        for msg, u in rows
    ]


async def send_club_message(db: AsyncSession, slug: str, user_id: uuid.UUID, content: str, media_url: str | None = None, media_type: str | None = None) -> dict:
    club_r = await db.execute(select(Club).where(Club.slug == slug))
    club = club_r.scalar_one_or_none()
    if not club:
        raise HTTPException(404, "Club not found")
    mr = await db.execute(select(ClubMember).where(ClubMember.club_id == club.id, ClubMember.user_id == user_id))
    if not mr.scalar_one_or_none():
        raise HTTPException(403, "Join the club to send messages")

    user_r = await db.execute(select(User).where(User.id == user_id))
    user = user_r.scalar_one()

    msg = ClubMessage(
        club_id=club.id,
        sender_id=user_id,
        content=content.strip()[:2000],
        media_url=media_url,
        media_type=media_type,
        created_at=datetime.now(timezone.utc),
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    return {
        "id": str(msg.id),
        "content": msg.content,
        "media_url": msg.media_url,
        "media_type": msg.media_type,
        "sender": user.username,
        "sender_display": user.display_name,
        "sender_avatar": user.avatar_url,
        "created_at": msg.created_at.isoformat(),
    }


def _club_dict(club: Club, role: str | None = None) -> dict:
    return {
        "id": str(club.id),
        "name": club.name,
        "slug": club.slug,
        "description": club.description,
        "icon_emoji": club.icon_emoji,
        "banner_url": club.banner_url,
        "member_count": club.member_count,
        "is_public": club.is_public,
        "role": role,
        "created_at": club.created_at.isoformat() if club.created_at else None,
    }
