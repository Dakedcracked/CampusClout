import base64
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.services.beauty_service import analyze_beauty, analyze_beauty_image, get_latest_beauty_score

router = APIRouter(prefix="/ai/beauty", tags=["beauty"])


class BeautyAssessment(BaseModel):
    skincare: int = Field(ge=1, le=10, description="Skincare routine quality 1-10")
    style: int = Field(ge=1, le=10, description="Fashion & style sense 1-10")
    grooming: int = Field(ge=1, le=10, description="Grooming & hygiene 1-10")
    fitness: int = Field(ge=1, le=10, description="Fitness & posture 1-10")
    confidence: int = Field(ge=1, le=10, description="Self-confidence & presence 1-10")


@router.post("/analyze")
async def analyze(
    body: BeautyAssessment,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(get_current_user_id(request))
    return await analyze_beauty(db, user_id, body.model_dump())


@router.get("/score")
async def latest_score(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(get_current_user_id(request))
    result = await get_latest_beauty_score(db, user_id)
    if not result:
        raise HTTPException(status_code=404, detail="No beauty score yet. Take the assessment first.")
    return result


@router.post("/analyze-image")
async def analyze_image(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(get_current_user_id(request))

    # Validate file size (8 MB limit for beauty images)
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 8 MB)")

    # Validate MIME type
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(400, "Only JPEG, PNG, and WebP images allowed for beauty analysis")

    # Validate magic bytes
    from app.api.v1.upload import _validate_magic_bytes
    if not _validate_magic_bytes(data, file.content_type):
        raise HTTPException(400, "File magic bytes do not match image type. File may be corrupted.")

    # Hard face-detection gate using MediaPipe + DeepFace (no vision model needed)
    from app.utils.face_rating import compute_attractiveness_score
    face_result = await compute_attractiveness_score(data)
    if not face_result.get("has_face", False):
        raise HTTPException(
            400,
            "No human face detected in this image. Please upload a clear, well-lit photo of a person's face. "
            "Cartoons, landscapes, objects, and group photos with obscured faces are not accepted."
        )

    b64 = base64.b64encode(data).decode()
    return await analyze_beauty_image(db, user_id, b64, file.content_type or "image/jpeg", face_result)
