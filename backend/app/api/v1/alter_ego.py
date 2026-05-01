import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.schemas.alter_ego import AlterEgoCreateRequest, AlterEgoResponse, AlterEgoToggleResponse
from app.schemas.auth import MessageResponse
from app.services.alter_ego_service import (
    create_alter_ego,
    delete_alter_ego,
    get_alter_ego,
    toggle_alter_ego,
)

router = APIRouter(prefix="/alter-ego", tags=["alter-ego"])


@router.get("", response_model=AlterEgoResponse | None)
async def my_alter_ego(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AlterEgoResponse | None:
    user_id = uuid.UUID(get_current_user_id(request))
    return await get_alter_ego(db, user_id)


@router.post("", response_model=AlterEgoResponse, status_code=status.HTTP_201_CREATED)
async def create(
    data: AlterEgoCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AlterEgoResponse:
    user_id = uuid.UUID(get_current_user_id(request))
    return await create_alter_ego(db, user_id, data)


@router.post("/toggle", response_model=AlterEgoToggleResponse)
async def toggle(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AlterEgoToggleResponse:
    user_id = uuid.UUID(get_current_user_id(request))
    return await toggle_alter_ego(db, user_id)


@router.delete("", response_model=MessageResponse, status_code=status.HTTP_200_OK)
async def delete(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    user_id = uuid.UUID(get_current_user_id(request))
    await delete_alter_ego(db, user_id)
    return MessageResponse(message="Alter-ego deleted")
