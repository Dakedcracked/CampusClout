"""
Image upload and storage service.

Handles profile images, cover images, and temporary file management.
Uses local file storage with UUID-based filenames.
"""

import uuid
import os
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


# Static directory for serving images
STATIC_DIR = Path("/home/aditya/Desktop/Sau-statup/backend/static")
PROFILE_IMAGES_DIR = STATIC_DIR / "profile_images"
COVER_IMAGES_DIR = STATIC_DIR / "cover_images"

# Create directories if they don't exist
PROFILE_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
COVER_IMAGES_DIR.mkdir(parents=True, exist_ok=True)


def _generate_unique_filename(filename: str) -> str:
    """Generate unique filename with UUID + original extension."""
    ext = Path(filename).suffix or ".jpg"
    return f"{uuid.uuid4()}{ext}"


async def upload_profile_image(
    db: AsyncSession, user_id: uuid.UUID, file_bytes: bytes, filename: str
) -> str:
    """Upload profile image and return URL.
    
    Args:
        db: Database session
        user_id: User uploading the image
        file_bytes: Raw image bytes
        filename: Original filename
    
    Returns:
        Relative URL to access the image
    """
    # Verify user exists
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete old profile image if exists
    if user.avatar_url:
        old_file = PROFILE_IMAGES_DIR / Path(user.avatar_url).name
        if old_file.exists():
            try:
                old_file.unlink()
            except Exception:
                pass
    
    # Save new image
    unique_name = _generate_unique_filename(filename)
    file_path = PROFILE_IMAGES_DIR / unique_name
    
    with open(file_path, "wb") as f:
        f.write(file_bytes)
    
    # Update user's avatar URL
    relative_url = f"/static/profile_images/{unique_name}"
    user.avatar_url = relative_url
    
    await db.commit()
    await db.refresh(user)
    
    return relative_url


async def upload_cover_image(
    db: AsyncSession, user_id: uuid.UUID, file_bytes: bytes, filename: str
) -> str:
    """Upload cover image and return URL.
    
    Args:
        db: Database session
        user_id: User uploading the image
        file_bytes: Raw image bytes
        filename: Original filename
    
    Returns:
        Relative URL to access the image
    """
    # Verify user exists
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Save cover image (could add cover_url field to User if desired)
    unique_name = _generate_unique_filename(filename)
    file_path = COVER_IMAGES_DIR / unique_name
    
    with open(file_path, "wb") as f:
        f.write(file_bytes)
    
    relative_url = f"/static/cover_images/{unique_name}"
    
    return relative_url


async def get_profile_image_url(db: AsyncSession, user_id: uuid.UUID) -> str | None:
    """Get profile image URL for a user."""
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user.avatar_url


async def delete_profile_image(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Delete user's profile image and clear avatar_url."""
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.avatar_url:
        # Extract filename from URL
        filename = Path(user.avatar_url).name
        file_path = PROFILE_IMAGES_DIR / filename
        
        if file_path.exists():
            try:
                file_path.unlink()
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to delete image: {str(e)}",
                )
        
        user.avatar_url = None
        await db.commit()


def validate_image_file(filename: str, file_bytes: bytes, max_size_mb: int = 5) -> bool:
    """Validate image file for size and format.
    
    Args:
        filename: Original filename
        file_bytes: Raw image bytes
        max_size_mb: Maximum file size in MB
    
    Raises:
        HTTPException if validation fails
    """
    # Check file size
    max_bytes = max_size_mb * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {max_size_mb}MB limit",
        )
    
    # Check file extension
    allowed_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    ext = Path(filename).suffix.lower()
    
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Only image files allowed: {', '.join(allowed_extensions)}",
        )
    
    # Basic magic number check for common image formats
    magic_numbers = {
        b"\xff\xd8\xff": ".jpg",  # JPEG
        b"\x89PNG": ".png",        # PNG
        b"GIF8": ".gif",           # GIF
        b"RIFF": ".webp",          # WebP
    }
    
    is_valid_image = any(file_bytes.startswith(magic) for magic in magic_numbers)
    
    if not is_valid_image:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid image file format",
        )
    
    return True


async def cleanup_old_images(days: int = 30) -> int:
    """Cleanup orphaned images older than N days. Returns count deleted."""
    import time
    
    cutoff_time = time.time() - (days * 24 * 60 * 60)
    deleted_count = 0
    
    for directory in [PROFILE_IMAGES_DIR, COVER_IMAGES_DIR]:
        if not directory.exists():
            continue
        
        for file_path in directory.iterdir():
            if file_path.is_file() and file_path.stat().st_mtime < cutoff_time:
                try:
                    file_path.unlink()
                    deleted_count += 1
                except Exception:
                    pass
    
    return deleted_count
