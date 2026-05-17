import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.user import User
from app.schemas.images import (
    CoverImageDeleteResponse,
    ImageUploadResponse,
    ProfileImageDeleteResponse,
)

router = APIRouter(prefix="/images", tags=["images"])

ALLOWED_FORMATS = {"jpg", "jpeg", "png"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def validate_image(file: UploadFile) -> tuple[str, int]:
    """Validate image file. Returns (format, size)."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Extract format from content_type
    format_map = {
        "image/jpeg": "jpg",
        "image/png": "png",
    }
    file_format = format_map.get(file.content_type)
    if not file_format:
        raise HTTPException(status_code=400, detail="Only JPG and PNG formats allowed")

    return file_format, file.size or 0


@router.post("/profile-image", response_model=ImageUploadResponse)
async def upload_profile_image(
    file: UploadFile = File(...),
    request: Request = ...,
    db: AsyncSession = Depends(get_db),
) -> ImageUploadResponse:
    """Upload profile picture. Returns new URL."""
    user_id = uuid.UUID(get_current_user_id(request))

    # Validate
    file_format, file_size = validate_image(file)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")

    # Read file content
    content = await file.read()

    # In production: upload to S3/cloud storage
    # For dev: generate a URL path
    filename = f"profile_{user_id}.{file_format}"
    url = f"/uploads/images/{filename}"

    # Get user and update avatar_url
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one()
    user.avatar_url = url
    await db.commit()

    return ImageUploadResponse(
        url=url,
        size=file_size,
        format=file_format,
    )


@router.post("/cover-image", response_model=ImageUploadResponse)
async def upload_cover_image(
    file: UploadFile = File(...),
    request: Request = ...,
    db: AsyncSession = Depends(get_db),
) -> ImageUploadResponse:
    """Upload cover image. Returns new URL."""
    user_id = uuid.UUID(get_current_user_id(request))

    # Validate
    file_format, file_size = validate_image(file)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")

    # Read file content
    content = await file.read()

    # In production: upload to S3/cloud storage
    # For dev: generate a URL path
    filename = f"cover_{user_id}.{file_format}"
    url = f"/uploads/images/{filename}"

    # In production: store URL in user.cover_image_url or similar field
    # For now: just return the URL

    return ImageUploadResponse(
        url=url,
        size=file_size,
        format=file_format,
    )


@router.delete("/profile-image", response_model=ProfileImageDeleteResponse)
async def delete_profile_image(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> ProfileImageDeleteResponse:
    """Delete profile picture."""
    user_id = uuid.UUID(get_current_user_id(request))

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one()

    user.avatar_url = None
    await db.commit()

    return ProfileImageDeleteResponse()


@router.delete("/cover-image", response_model=CoverImageDeleteResponse)
async def delete_cover_image(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> CoverImageDeleteResponse:
    """Delete cover image."""
    user_id = uuid.UUID(get_current_user_id(request))

    # In production: clear cover_image_url field
    # For now: just return success

    return CoverImageDeleteResponse()
