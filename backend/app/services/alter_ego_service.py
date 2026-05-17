import secrets
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.economy import AlterEgo
from app.schemas.alter_ego import AlterEgoCreateRequest, AlterEgoResponse, AlterEgoToggleResponse


async def create_alter_ego(
    db: AsyncSession, user_id: uuid.UUID, data: AlterEgoCreateRequest
) -> AlterEgoResponse:
    # Enforce one alter-ego per user
    existing = await db.execute(select(AlterEgo).where(AlterEgo.user_id == user_id))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an alter-ego. Delete it first to create a new one.",
        )

    # Check alias uniqueness
    alias_check = await db.execute(select(AlterEgo).where(AlterEgo.alias == data.alias))
    if alias_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That alias is already taken",
        )

    alter_ego = AlterEgo(
        user_id=user_id,
        alias=data.alias,
        avatar_seed=secrets.token_hex(8),  # deterministic seed for avatar generation
        is_active=False,
    )
    db.add(alter_ego)
    await db.commit()
    await db.refresh(alter_ego)
    return AlterEgoResponse.model_validate(alter_ego)


async def get_alter_ego(db: AsyncSession, user_id: uuid.UUID) -> AlterEgoResponse | None:
    result = await db.execute(select(AlterEgo).where(AlterEgo.user_id == user_id))
    ae = result.scalar_one_or_none()
    return AlterEgoResponse.model_validate(ae) if ae else None


async def toggle_alter_ego(
    db: AsyncSession, user_id: uuid.UUID
) -> AlterEgoToggleResponse:
    result = await db.execute(select(AlterEgo).where(AlterEgo.user_id == user_id))
    ae = result.scalar_one_or_none()
    if not ae:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No alter-ego found. Create one first.",
        )

    ae.is_active = not ae.is_active
    await db.commit()

    state = "activated" if ae.is_active else "deactivated"
    return AlterEgoToggleResponse(
        is_active=ae.is_active,
        alias=ae.alias if ae.is_active else None,
        message=f"Alter-ego '{ae.alias}' {state}.",
    )


async def delete_alter_ego(db: AsyncSession, user_id: uuid.UUID) -> None:
    result = await db.execute(select(AlterEgo).where(AlterEgo.user_id == user_id))
    ae = result.scalar_one_or_none()
    if not ae:
        raise HTTPException(status_code=404, detail="No alter-ego to delete")
    db.delete(ae)
    await db.commit()
