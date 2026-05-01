import secrets
import uuid

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    clear_auth_cookies,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user_id,
    set_auth_cookies,
)
from app.middleware.rate_limit import enforce_rate_limit
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    TokenRefreshResponse,
    UserResponse,
    VerifyEmailRequest,
)
from app.schemas.chat import WsTicketResponse
from app.services.auth_service import (
    authenticate_user,
    get_user_by_id,
    register_user,
    verify_email,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def register(
    data: RegisterRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await enforce_rate_limit(request)
    user, verification_token = await register_user(db, data)

    # In production, email this token. For dev, return it in the response body.
    msg = "Registration successful. Please verify your email."
    from app.core.config import settings
    if settings.DEBUG:
        msg += f" [DEV] Verification token: {verification_token}"

    return MessageResponse(message=msg)


@router.post("/login", response_model=UserResponse)
async def login(
    data: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    await enforce_rate_limit(request)
    user = await authenticate_user(db, data.email, data.password)

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    set_auth_cookies(response, access_token, refresh_token)

    return UserResponse.model_validate(user)


@router.post("/logout", response_model=MessageResponse)
async def logout(response: Response) -> MessageResponse:
    clear_auth_cookies(response)
    return MessageResponse(message="Logged out successfully")


@router.post("/refresh", response_model=TokenRefreshResponse)
async def refresh_token(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
) -> TokenRefreshResponse:
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token",
        )

    user_id = decode_token(refresh_token, expected_type="refresh")
    new_access = create_access_token(user_id)
    new_refresh = create_refresh_token(user_id)
    set_auth_cookies(response, new_access, new_refresh)

    return TokenRefreshResponse()


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email_endpoint(
    data: VerifyEmailRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await enforce_rate_limit(request)
    await verify_email(db, data.token)
    return MessageResponse(message="Email verified successfully")


@router.get("/me", response_model=UserResponse)
async def get_me(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    user_id = get_current_user_id(request)
    user = await get_user_by_id(db, user_id)
    return UserResponse.model_validate(user)


@router.post("/ws-ticket", response_model=WsTicketResponse)
async def get_ws_ticket(request: Request) -> WsTicketResponse:
    """Short-lived single-use ticket for authenticating WebSocket connections.

    HttpOnly cookies can't be read by JS and won't cross port boundaries in dev,
    so the client calls this endpoint (cookie auth) to get a 30-second ticket,
    then passes it as ?ticket= when opening the WS connection.
    """
    user_id = get_current_user_id(request)
    ticket = secrets.token_urlsafe(32)

    redis = getattr(request.app.state, "redis", None)
    if redis:
        await redis.setex(
            f"cc:ws_ticket:{ticket}",
            settings.WS_TICKET_TTL_SECONDS,
            user_id,
        )
    else:
        # Dev fallback: embed user_id in ticket so auth still works without Redis
        ticket = f"dev:{user_id}"

    return WsTicketResponse(ticket=ticket, expires_in=settings.WS_TICKET_TTL_SECONDS)


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(None, max_length=64)
    bio: str | None = Field(None, max_length=500)
    avatar_url: str | None = Field(None, max_length=512)


@router.patch("/me")
async def update_profile(
    body: ProfileUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(get_current_user_id(request))
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    if body.display_name is not None:
        user.display_name = body.display_name.strip() or None
    if body.bio is not None:
        user.bio = body.bio.strip() or None
    if body.avatar_url is not None:
        user.avatar_url = body.avatar_url or None
    await db.commit()
    await db.refresh(user)
    return {
        "id": str(user.id),
        "username": user.username,
        "display_name": user.display_name,
        "bio": user.bio,
        "avatar_url": user.avatar_url,
        "email": user.email,
        "university_domain": user.university_domain,
        "is_verified": user.is_verified,
    }
