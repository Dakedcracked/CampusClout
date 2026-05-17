import uuid
import math
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.user import User
from app.models.match import Match
from app.services.concierge_service import trigger_date_concierge

router = APIRouter(prefix="/matches", tags=["matches"])


def cosine_similarity(v1: list, v2: list) -> float:
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot_product = sum(a * b for a, b in zip(v1, v2))
    norm_a = math.sqrt(sum(a * a for a in v1))
    norm_b = math.sqrt(sum(b * b for b in v2))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot_product / (norm_a * norm_b)


@router.get("/suggestions", response_model=List[dict])
async def get_match_suggestions(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Get vector-based match suggestions for the current user."""
    current_user_id = uuid.UUID(get_current_user_id(request))

    # Load current user with clout_balance
    me_result = await db.execute(
        select(User).where(User.id == current_user_id).options(selectinload(User.clout_balance))
    )
    current_user = me_result.scalar_one_or_none()
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    result = await db.execute(
        select(User)
        .where(
            User.university_id == current_user.university_id,
            User.id != current_user.id,
        )
        .options(selectinload(User.clout_balance))
        .limit(100)
    )
    users = result.scalars().all()

    my_embedding = current_user.embedding or []
    scored_users = []
    for u in users:
        score = cosine_similarity(my_embedding, u.embedding or []) if my_embedding else u.vote_score
        scored_users.append({"user": u, "score": score})

    scored_users.sort(key=lambda x: x["score"], reverse=True)

    suggestions = []
    for su in scored_users[:10]:
        u = su["user"]
        suggestions.append({
            "id": str(u.id),
            "username": u.username,
            "display_name": u.display_name,
            "avatar_url": u.avatar_url,
            "similarity_score": round(su["score"], 2),
            "market_cap": u.clout_balance.market_cap if u.clout_balance else 0,
        })

    return suggestions


@router.post("/{target_id}/green-light")
async def toggle_green_light(
    target_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Toggle green-light for a specific match."""
    current_user_id = uuid.UUID(get_current_user_id(request))
    target_uuid = uuid.UUID(target_id)

    # Load current user
    me_result = await db.execute(select(User).where(User.id == current_user_id))
    current_user = me_result.scalar_one_or_none()
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    result = await db.execute(
        select(Match).where(
            or_(
                and_(Match.user_a_id == current_user_id, Match.user_b_id == target_uuid),
                and_(Match.user_a_id == target_uuid, Match.user_b_id == current_user_id),
            )
        )
    )
    match = result.scalar_one_or_none()
    is_mutual = False

    if not match:
        match = Match(
            user_a_id=current_user_id,
            user_b_id=target_uuid,
            green_light_a=True,
            green_light_b=False,
        )
        db.add(match)
        await db.flush()
    else:
        if match.user_a_id == current_user_id:
            match.green_light_a = not match.green_light_a
        else:
            match.green_light_b = not match.green_light_b
        is_mutual = match.green_light_a and match.green_light_b

    await db.commit()

    if is_mutual:
        other_user_id = match.user_b_id if match.user_a_id == current_user_id else match.user_a_id
        other_result = await db.execute(select(User).where(User.id == other_user_id))
        other_user = other_result.scalar_one()
        await trigger_date_concierge(db, current_user, other_user)

    return {
        "match_id": str(match.id),
        "is_mutual_green_light": is_mutual,
        "message": "🟢 Green light! Date Concierge activated." if is_mutual else "Green light set. Waiting for them.",
    }
