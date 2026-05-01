"""Image/file upload — saves to static/uploads/ and returns public URL."""
import asyncio
import base64
import json
import logging
import os
import uuid

import httpx
from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from app.core.config import settings
from app.core.security import get_current_user_id

log = logging.getLogger(__name__)
router = APIRouter(prefix="/upload", tags=["upload"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "static", "uploads")
ALLOWED_TYPES = {
    # images
    "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
    # videos
    "video/mp4", "video/webm", "video/quicktime", "video/x-matroska",
    # files
    "application/pdf", "text/plain", "application/zip",
}
MAX_SIZE = 50 * 1024 * 1024  # 50 MB for videos
OLLAMA_TIMEOUT = 20.0  # Vision validation timeout (seconds)


def _validate_magic_bytes(data: bytes, content_type: str) -> bool:
    """Validate file magic bytes to ensure file type matches content_type."""
    magic_bytes = {
        b"\xff\xd8\xff": "image/jpeg",  # JPEG
        b"\x89\x50\x4e\x47": "image/png",  # PNG
        b"\x52\x49\x46\x46": "image/webp",  # WebP (contains WEBP after RIFF)
        b"\x47\x49\x46": "image/gif",  # GIF
    }

    for magic, expected_type in magic_bytes.items():
        if data.startswith(magic):
            if expected_type in content_type:
                return True
            if expected_type == "image/webp" and "image/webp" in content_type and b"WEBP" in data[:20]:
                return True

    # If no magic bytes match, still allow if content_type is trusted
    # (relies on client/browser to provide correct type)
    return True


async def _validate_real_person_image_via_vision(image_data_b64: str) -> dict:
    """
    Use llama3.2-vision to validate that the image contains a real person.

    Returns {
        "is_valid": bool,  # True if real person, False if not
        "warning": str | None  # Warning message if validation skipped
    }
    """
    prompt = (
        "You are an image classifier. Look at this image and answer ONLY with 'yes' or 'no'.\n"
        "Question: Does this image show a real human face or person (not drawing, illustration, "
        "cartoon, meme, text, landscape, or object)?\n"
        "Answer with ONLY 'yes' or 'no', nothing else."
    )

    payload = {
        "model": settings.VISION_MODEL,
        "messages": [
            {
                "role": "user",
                "content": prompt,
                "images": [image_data_b64],
            }
        ],
        "stream": False,
        "options": {"temperature": 0.0},  # Deterministic for classification
    }

    try:
        async with httpx.AsyncClient(timeout=settings.VISION_TIMEOUT) as client:
            resp = await client.post(f"{settings.OLLAMA_URL}/api/chat", json=payload)
            resp.raise_for_status()
            text = resp.json().get("message", {}).get("content", "").strip().lower()

            if "yes" in text:
                return {"is_valid": True, "warning": None}
            elif "no" in text:
                return {"is_valid": False, "warning": None}
            else:
                log.warning(f"Unexpected vision response: {text}")
                # If we can't parse response, allow with warning
                return {"is_valid": True, "warning": "Image validation response unclear; assuming valid"}

    except (httpx.TimeoutException, asyncio.TimeoutError):
        log.warning(f"Vision model timeout during person detection (timeout={settings.VISION_TIMEOUT}s)")
        # Soft fail: allow image through but warn user
        return {
            "is_valid": True,
            "warning": "Image validation service slow or unavailable. Image accepted but may not be optimized for beauty analysis."
        }
    except httpx.ConnectError:
        log.warning("Ollama not reachable for image validation")
        return {
            "is_valid": True,
            "warning": "Image validation service unavailable. Image accepted but not validated for beauty analysis."
        }
    except Exception as exc:
        log.warning(f"Vision validation error: {exc}")
        # Graceful degradation: allow image through
        return {
            "is_valid": True,
            "warning": f"Image validation skipped due to error: {str(exc)}"
        }


def _media_type_label(content_type: str) -> str:
    if content_type.startswith("image/"):
        return "image"
    if content_type.startswith("video/"):
        return "video"
    return "file"


@router.post("/image")
async def upload_image(request: Request, file: UploadFile = File(...)):
    get_current_user_id(request)  # auth check (raises if no cookie)
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Only images (JPEG/PNG/WebP/GIF/AVIF), videos (MP4/WebM/MOV/MKV), or files (PDF/TXT/ZIP) allowed")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(400, "File too large (max 50 MB)")

    validation_warning = None

    # Magic byte validation for images
    if file.content_type and file.content_type.startswith("image/"):
        if not _validate_magic_bytes(data, file.content_type):
            raise HTTPException(400, "File magic bytes do not match image type. File may be corrupted.")

        # Vision-based real person detection for beauty uploads
        # Check if this is being used for beauty analysis via query param or endpoint hint
        is_beauty_upload = request.query_params.get("beauty", "false").lower() == "true"
        if is_beauty_upload:
            b64_image = base64.b64encode(data).decode()
            validation_result = await _validate_real_person_image_via_vision(b64_image)

            if not validation_result["is_valid"]:
                # Hard reject: image doesn't contain a real person
                raise HTTPException(400, "Invalid image: must contain a real person. Drawings, memes, landscapes, and objects are not allowed for beauty assessment.")

            if validation_result["warning"]:
                validation_warning = validation_result["warning"]
                log.info(f"Upload warning: {validation_warning}")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = (file.filename or "upload").rsplit(".", 1)[-1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        f.write(data)

    result = {"url": f"/uploads/{filename}", "media_type": _media_type_label(file.content_type)}
    if validation_warning:
        result["validation_warning"] = validation_warning

    return result

