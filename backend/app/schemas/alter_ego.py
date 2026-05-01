import re
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

ALIAS_RE = re.compile(r"^[a-zA-Z0-9_]{3,32}$")


class AlterEgoCreateRequest(BaseModel):
    alias: str = Field(min_length=3, max_length=32)

    @field_validator("alias")
    @classmethod
    def alias_format(cls, v: str) -> str:
        if not ALIAS_RE.match(v):
            raise ValueError("Alias may only contain letters, numbers, and underscores (3-32 chars)")
        return v.lower()


class AlterEgoResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    alias: str
    avatar_seed: str
    is_active: bool
    created_at: datetime


class AlterEgoToggleResponse(BaseModel):
    is_active: bool
    alias: str | None
    message: str
