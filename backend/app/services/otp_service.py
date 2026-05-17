import random
import string
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.otp import OTPSession
from app.services.email_service import send_otp_email
from fastapi import HTTPException, status


async def generate_otp() -> str:
    """Generate a random 6-digit OTP code."""
    return "".join(random.choices(string.digits, k=6))


async def create_otp_session(
    db: AsyncSession,
    email: str,
    user_id: str | None = None,
) -> OTPSession:
    """Create and send new OTP session."""
    
    # Invalidate previous OTP sessions for this email
    await db.execute(
        select(OTPSession)
        .where(
            and_(
                OTPSession.email == email.lower(),
                OTPSession.is_verified == False,
            )
        )
    )
    
    # Generate OTP
    otp_code = await generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    otp_session = OTPSession(
        email=email.lower(),
        otp_code=otp_code,
        expires_at=expires_at,
        user_id=user_id,
    )
    
    db.add(otp_session)
    await db.flush()
    
    # Send email
    await send_otp_email(
        recipient_email=email,
        otp_code=otp_code,
        recipient_name=user_id or "",
    )
    
    return otp_session


async def verify_otp(
    db: AsyncSession,
    email: str,
    otp_code: str,
) -> OTPSession:
    """Verify OTP code and return session if valid."""
    
    email = email.lower()
    
    # Find the latest unverified OTP session
    result = await db.execute(
        select(OTPSession)
        .where(
            and_(
                OTPSession.email == email,
                OTPSession.is_verified == False,
            )
        )
        .order_by(OTPSession.created_at.desc())
    )
    
    otp_session = result.scalars().first()
    
    if not otp_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No OTP session found. Request a new code.",
        )
    
    # Check if expired
    if datetime.now(timezone.utc) > otp_session.expires_at:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="OTP code expired. Request a new code.",
        )
    
    # Check if max attempts exceeded
    if otp_session.attempts >= otp_session.max_attempts:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Request a new code.",
        )
    
    # Check if code matches
    if otp_session.otp_code != otp_code:
        otp_session.attempts += 1
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid OTP code. {otp_session.max_attempts - otp_session.attempts} attempts remaining.",
        )
    
    # Mark as verified
    otp_session.is_verified = True
    otp_session.verified_at = datetime.now(timezone.utc)
    await db.commit()
    
    return otp_session


async def resend_otp(db: AsyncSession, email: str) -> OTPSession:
    """Resend OTP to email (creates new session)."""
    email = email.lower()
    
    # Check for recent OTP attempts (rate limiting)
    result = await db.execute(
        select(OTPSession)
        .where(OTPSession.email == email)
        .order_by(OTPSession.created_at.desc())
    )
    
    recent = result.scalars().first()
    
    if recent:
        time_diff = datetime.now(timezone.utc) - recent.created_at
        if time_diff.total_seconds() < 60:  # Rate limit to 1 per minute
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Please wait before requesting another code.",
            )
    
    return await create_otp_session(db, email)


async def get_otp_session(
    db: AsyncSession,
    email: str,
) -> OTPSession | None:
    """Get the latest OTP session for an email."""
    result = await db.execute(
        select(OTPSession)
        .where(OTPSession.email == email.lower())
        .order_by(OTPSession.created_at.desc())
    )
    return result.scalars().first()
