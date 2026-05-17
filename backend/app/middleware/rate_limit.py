from fastapi import HTTPException, Request, status
from redis.asyncio import Redis


RULES: dict[str, tuple[int, int]] = {
    # CRITICAL SECURITY: Brute force protection on auth endpoints
    "/api/v1/auth/register": (3, 3600),       # 3 per hour - strict signup limiting
    "/api/v1/auth/login": (5, 900),           # 5 per 15 minutes - PRODUCTION HARDENED
    "/api/v1/auth/otp/request": (5, 600),     # 5 per 10 minutes - OTP spamming protection
    "/api/v1/auth/otp/verify": (10, 900),     # 10 per 15 minutes
    "/api/v1/auth/verify-email": (5, 600),    # 5 per 10 min - strict verification attempts
    
    # Economic features - prevent currency manipulation
    "/api/v1/economy/invest": (20, 60),       # 20 per minute
    "/api/v1/economy/withdraw": (20, 60),     # 20 per minute - prevent rapid wealth transfer
    
    # Social engagement - prevent spam and manipulation
    "/api/v1/profiles/vote": (15, 60),        # 15 votes per minute
    "/api/v1/feed/comments": (10, 60),        # 10 comments per minute
    "/api/v1/feed": (5, 60),                  # 5 post creations per minute - strict
    "/api/v1/feed/share": (20, 60),           # 20 shares per minute
    "/api/v1/feed/track": (100, 60),          # 100 tracking events per minute
    "/api/v1/feed/like": (30, 60),            # 30 likes per minute
}


async def enforce_rate_limit(request: Request) -> None:
    redis: Redis | None = getattr(request.app.state, "redis", None)
    if redis is None:
        return  # Graceful degradation if Redis is unavailable

    rule = RULES.get(request.url.path)
    if not rule:
        return

    limit, window = rule
    client_ip = request.client.host if request.client else "unknown"
    key = f"rl:{request.url.path}:{client_ip}"

    try:
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, window)
        if count > limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded ({limit} requests per {window}s). Slow down.",
                headers={"Retry-After": str(window)},
            )
    except HTTPException:
        raise
    except Exception:
        pass  # Never block the request if Redis has an unexpected error
