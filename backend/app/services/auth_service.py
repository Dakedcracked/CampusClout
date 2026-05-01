import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import hash_password, is_university_email, verify_password
from app.models.economy import CloutBalance, EmailVerification, TransactionType, TokenTransaction
from app.models.user import User
from app.schemas.auth import RegisterRequest


async def register_user(db: AsyncSession, data: RegisterRequest) -> tuple[User, str]:
    if not is_university_email(data.email):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only university email addresses are allowed (.edu or international equivalents)",
        )

    existing = await db.execute(
        select(User).where(
            (User.email == data.email) | (User.username == data.username)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or username already registered",
        )

    domain = data.email.split("@")[-1].lower()
    user = User(
        email=data.email.lower(),
        username=data.username.lower(),
        hashed_password=hash_password(data.password),
        university_domain=domain,
        display_name=data.display_name or data.username,
    )
    db.add(user)
    await db.flush()  # get user.id before creating related rows

    # Mint signup bonus tokens
    balance = CloutBalance(user_id=user.id, wallet_balance=settings.SIGNUP_BONUS_TOKENS)
    db.add(balance)

    mint_tx = TokenTransaction(
        from_user_id=None,
        to_user_id=user.id,
        amount=settings.SIGNUP_BONUS_TOKENS,
        transaction_type=TransactionType.MINT,
        note="Signup bonus",
    )
    db.add(mint_tx)

    # Create email verification token
    verification_token = secrets.token_urlsafe(48)
    verification = EmailVerification(
        user_id=user.id,
        token=verification_token,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(verification)

    await db.commit()
    await db.refresh(user)
    return user, verification_token


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    result = await db.execute(
        select(User)
        .where(User.email == email.lower())
        .options(selectinload(User.clout_balance))
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    user.last_active_at = datetime.now(timezone.utc)
    await db.commit()

    return user


async def verify_email(db: AsyncSession, token: str) -> User:
    result = await db.execute(
        select(EmailVerification)
        .where(EmailVerification.token == token, EmailVerification.is_used == False)
        .options(selectinload(EmailVerification.user))
    )
    verification = result.scalar_one_or_none()

    if not verification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification token not found or already used",
        )

    if verification.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Verification token has expired",
        )

    verification.is_used = True
    verification.user.is_verified = True
    await db.commit()
    return verification.user


async def get_user_by_id(db: AsyncSession, user_id: str) -> User:
    result = await db.execute(
        select(User)
        .where(User.id == uuid.UUID(user_id))
        .options(selectinload(User.clout_balance))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user
