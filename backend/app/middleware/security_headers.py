"""Security HTTP headers middleware — applied to every response."""
import os
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

# Allow the backend to be reachable from any HTTPS origin (needed for Vercel → Railway)
_BACKEND_URL = os.environ.get("RAILWAY_PUBLIC_DOMAIN", "")
_FRONTEND_URL = os.environ.get("FRONTEND_URL", "")
_extra_connect = ""
if _BACKEND_URL:
    _extra_connect += f" https://{_BACKEND_URL} wss://{_BACKEND_URL}"
if _FRONTEND_URL:
    _extra_connect += f" {_FRONTEND_URL}"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        # CSP: allow images from anywhere (CDN avatars), scripts only from self
        # connect-src allows HTTPS/WSS so Vercel can reach Railway backend
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "img-src * data: blob:; "
            "media-src *; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            f"connect-src 'self' https: wss: ws:{_extra_connect};"
        )
        return response
