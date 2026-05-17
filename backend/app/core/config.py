from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Annotated
from pydantic import BeforeValidator
import json


def _parse_list(v: str | list) -> list[str]:
    if isinstance(v, list):
        return v
    s = (v or "").strip()
    if not s or s == "[]":
        return []
    if s.startswith("["):
        try:
            return json.loads(s)
        except json.JSONDecodeError:
            pass
    return [item.strip() for item in s.split(",") if item.strip()]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "CampusClout"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # "development" | "production"

    # Frontend URL (Vercel domain in prod, localhost in dev)
    FRONTEND_URL: str = "http://localhost:3000"

    CORS_ORIGINS: Annotated[list[str], BeforeValidator(_parse_list)] = [
        "http://localhost:3000"
    ]

    @property
    def all_cors_origins(self) -> list[str]:
        """Merge CORS_ORIGINS with FRONTEND_URL so Railway always allows the Vercel domain."""
        origins = list(self.CORS_ORIGINS)
        if self.FRONTEND_URL and self.FRONTEND_URL not in origins:
            origins.append(self.FRONTEND_URL)
        return origins

    @property
    def cookie_samesite(self) -> str:
        """Cross-site cookies need samesite=none when frontend and backend are on different domains."""
        return "none" if self.ENVIRONMENT == "production" else "lax"

    @property
    def cookie_secure(self) -> bool:
        """samesite=none requires secure=True (HTTPS only)."""
        return self.ENVIRONMENT == "production"

    DATABASE_URL: str = (
        "postgresql+asyncpg://campusclout:campusclout@localhost:5432/campusclout"
    )

    REDIS_URL: str = "redis://localhost:6379"

    JWT_SECRET_KEY: str = "dev-secret-CHANGE-IN-PROD"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    ALLOWED_EMAIL_DOMAINS: Annotated[list[str], BeforeValidator(_parse_list)] = []
    REQUIRE_EDU_EMAIL: bool = False

    SIGNUP_BONUS_TOKENS: int = 100
    MAX_INVEST_PERCENTAGE: float = 0.5

    # Ollama AI
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1:8b"

    # Vision Model (for image analysis and validation)
    VISION_MODEL: str = "llama3.2-vision"
    VISION_MODEL_FALLBACK: str = "llava"
    VISION_TIMEOUT: int = 20  # seconds

    # Chat
    WS_TICKET_TTL_SECONDS: int = 30
    CHAT_IDLE_MINUTES: int = 5

    # Storefronts
    STOREFRONT_MIN_MARKET_CAP: float = 500.0

    # Email Service (Mailgun)
    MAILGUN_API_KEY: str | None = None
    MAILGUN_DOMAIN: str | None = None
    SENDER_EMAIL: str = "noreply@campusclout.app"


settings = Settings()
