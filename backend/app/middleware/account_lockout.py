"""
Account lockout protection against brute force attacks.
Locks account after 5 failed login attempts within 15 minutes.
"""

from fastapi import HTTPException, Request, status
from redis.asyncio import Redis


FAILED_ATTEMPTS_LIMIT = 5
LOCKOUT_DURATION_SECONDS = 900  # 15 minutes


async def check_account_lockout(email: str, request: Request) -> None:
    """
    Check if account is locked due to too many failed login attempts.
    
    Args:
        email: User email
        request: FastAPI request object (contains redis connection)
    
    Raises:
        HTTPException: If account is locked
    """
    redis: Redis | None = getattr(request.app.state, "redis", None)
    if redis is None:
        return  # Graceful degradation if Redis is unavailable
    
    try:
        lockout_key = f"lockout:{email.lower()}"
        is_locked = await redis.exists(lockout_key)
        
        if is_locked:
            ttl = await redis.ttl(lockout_key)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Account temporarily locked due to too many failed login attempts. Try again in {ttl} seconds.",
                headers={"Retry-After": str(ttl)},
            )
    except HTTPException:
        raise
    except Exception:
        return  # If Redis connection fails, allow request through


async def record_failed_login(email: str, request: Request) -> None:
    """
    Record a failed login attempt. Lock account if threshold exceeded.
    
    Args:
        email: User email
        request: FastAPI request object (contains redis connection)
    """
    redis: Redis | None = getattr(request.app.state, "redis", None)
    if redis is None:
        return  # Graceful degradation
    
    attempts_key = f"failed_attempts:{email.lower()}"
    
    try:
        # Increment failed attempts
        attempts = await redis.incr(attempts_key)
        
        # Set expiration on first attempt
        if attempts == 1:
            await redis.expire(attempts_key, LOCKOUT_DURATION_SECONDS)
        
        # Lock account if threshold exceeded
        if attempts >= FAILED_ATTEMPTS_LIMIT:
            lockout_key = f"lockout:{email.lower()}"
            await redis.setex(lockout_key, LOCKOUT_DURATION_SECONDS, "locked")
            # Clear attempts counter
            await redis.delete(attempts_key)
    except Exception:
        pass  # Never block request if Redis fails


async def clear_failed_login_attempts(email: str, request: Request) -> None:
    """
    Clear failed login attempts on successful login.
    
    Args:
        email: User email
        request: FastAPI request object (contains redis connection)
    """
    redis: Redis | None = getattr(request.app.state, "redis", None)
    if redis is None:
        return  # Graceful degradation
    
    try:
        attempts_key = f"failed_attempts:{email.lower()}"
        await redis.delete(attempts_key)
    except Exception:
        pass  # Never block request if Redis fails
