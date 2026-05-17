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
from app.middleware.account_lockout import (
    check_account_lockout,
    record_failed_login,
    clear_failed_login_attempts,
)
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    MessageResponse,
    OTPRequestRequest,
    OTPVerifyRequest,
    OTPResendRequest,
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
from app.services.otp_service import (
    create_otp_session,
    verify_otp,
    resend_otp,
)
from app.services.tracking_service import set_tracking_consent

router = APIRouter(prefix="/auth", tags=["auth"])


# ==================== OTP-BASED AUTH ====================

@router.post("/otp/request", response_model=MessageResponse, status_code=status.HTTP_200_OK)
async def request_otp(
    data: OTPRequestRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Request OTP code for login/registration."""
    await enforce_rate_limit(request)
    
    await create_otp_session(db, data.email)
    return MessageResponse(message="OTP sent to your email. Valid for 10 minutes.")


@router.post("/otp/verify", response_model=UserResponse)
async def verify_otp_login(
    data: OTPVerifyRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Verify OTP and log in user."""
    await enforce_rate_limit(request)
    
    # Verify OTP
    otp_session = await verify_otp(db, data.email, data.otp_code)
    
    # Check if user exists
    user_result = await db.execute(
        select(User).where(User.email == data.email.lower())
    )
    user = user_result.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Please register first.",
        )
    
    # Ensure user is verified
    if not user.is_verified:
        user.is_verified = True
        await db.commit()
    
    # Create session tokens
    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    set_auth_cookies(response, access_token, refresh_token)
    
    return UserResponse.model_validate(user)


@router.post("/otp/resend", response_model=MessageResponse)
async def resend_otp_code(
    data: OTPResendRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Resend OTP code (rate limited to 1 per minute)."""
    await enforce_rate_limit(request)
    
    await resend_otp(db, data.email)
    return MessageResponse(message="OTP resent to your email.")


# ==================== LEGACY PASSWORD-BASED AUTH ====================

@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def register(
    data: RegisterRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await enforce_rate_limit(request)
    user, verification_token = await register_user(db, data)
    
    # Set default tracking consent
    await set_tracking_consent(
        db,
        user.id,
        behavior_tracking=True,
        analytics=True,
        personalization=True,
    )

    msg = "Registration successful! You can now log in."
    return MessageResponse(message=msg)


@router.post("/login", response_model=UserResponse)
async def login(
    data: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    # PRODUCTION SECURITY: Check rate limiting
    await enforce_rate_limit(request)
    
    # PRODUCTION SECURITY: Check if account is locked due to failed attempts
    await check_account_lockout(data.email, request)
    
    try:
        user = await authenticate_user(db, data.email, data.password)
    except HTTPException:
        # Record failed login attempt (will trigger lockout after 5 attempts)
        await record_failed_login(data.email, request)
        raise

    # Clear failed attempts on successful login
    await clear_failed_login_attempts(data.email, request)

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
    trending_pics: list[str] | None = Field(None)
    college_name: str | None = Field(None, max_length=128)
    major: str | None = Field(None, max_length=128)
    interests: list[str] | None = Field(None)


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
    if body.trending_pics is not None:
        user.trending_pics = body.trending_pics
    if body.college_name is not None:
        user.college_name = body.college_name.strip() or None
    if body.major is not None:
        user.major = body.major.strip() or None
    if body.interests is not None:
        user.interests = [i.strip() for i in body.interests if i.strip()]
    
    # Auto-generate a simple embedding from bio + display_name for vector matchmaking
    if body.bio is not None or body.display_name is not None:
        text = f"{user.display_name or ''} {user.bio or ''} {' '.join(user.interests or [])}".lower()
        words = text.split()
        # Build a 128-dim word-hash embedding
        embedding = [0.0] * 128
        for word in words:
            idx = hash(word) % 128
            embedding[idx] += 1.0
        # Normalize
        norm = sum(x * x for x in embedding) ** 0.5
        if norm > 0:
            embedding = [x / norm for x in embedding]
        user.embedding = embedding
    
    await db.commit()
    await db.refresh(user)
    return {
        "id": str(user.id),
        "username": user.username,
        "display_name": user.display_name,
        "bio": user.bio,
        "avatar_url": user.avatar_url,
        "trending_pics": user.trending_pics,
        "email": user.email,
        "university_domain": user.university_domain,
        "is_verified": user.is_verified,
        "college_name": user.college_name,
        "major": user.major,
        "interests": user.interests or [],
    }
