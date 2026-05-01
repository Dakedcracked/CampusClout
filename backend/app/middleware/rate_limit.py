from fastapi import HTTPException, Request, status
from redis.asyncio import Redis


RULES: dict[str, tuple[int, int]] = {
    "/api/v1/auth/register": (5, 3600),    # 5 per hour
    "/api/v1/auth/login": (10, 900),        # 10 per 15 min
    "/api/v1/auth/verify-email": (10, 600), # 10 per 10 min
    "/api/v1/economy/invest": (30, 60),     # 30 per minute
    "/api/v1/economy/withdraw": (30, 60),
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
