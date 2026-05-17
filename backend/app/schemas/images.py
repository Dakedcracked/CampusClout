from pydantic import BaseModel, Field


class ImageUploadResponse(BaseModel):
    url: str
    size: int
    format: str


class ProfileImageDeleteResponse(BaseModel):
    status: str = "profile_image_deleted"


class CoverImageDeleteResponse(BaseModel):
    status: str = "cover_image_deleted"
