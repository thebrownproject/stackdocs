# backend/app/auth.py
"""Clerk authentication for FastAPI"""

import httpx
from fastapi import Request, HTTPException
from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions
from functools import lru_cache

from .config import get_settings


@lru_cache()
def get_clerk_client() -> Clerk:
    """Get cached Clerk client instance"""
    settings = get_settings()
    return Clerk(bearer_auth=settings.CLERK_SECRET_KEY)


async def get_current_user(request: Request) -> str:
    """
    FastAPI dependency to get authenticated Clerk user ID.

    Returns the Clerk user ID (sub claim) from the JWT.
    Raises 401 if not authenticated.

    In DEBUG mode, skips auth if no Authorization header (for Swagger testing).
    """
    settings = get_settings()

    # Dev mode bypass: skip auth if DEBUG and no Authorization header
    if settings.DEBUG:
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return "dev_user_test"  # Default dev user for Swagger testing

    clerk = get_clerk_client()

    # Convert FastAPI request to httpx.Request for Clerk SDK
    httpx_request = httpx.Request(
        method=request.method,
        url=str(request.url),
        headers=dict(request.headers)
    )

    # Parse authorized parties from config
    authorized_parties = [
        p.strip() for p in settings.CLERK_AUTHORIZED_PARTIES.split(",")
    ]

    request_state = clerk.authenticate_request(
        httpx_request,
        AuthenticateRequestOptions(
            authorized_parties=authorized_parties
        )
    )

    if not request_state.is_signed_in:
        raise HTTPException(
            status_code=401,
            detail=f"Unauthorized: {request_state.reason}"
        )

    user_id = request_state.payload.get('sub')
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid token: missing user ID"
        )

    return user_id


# Type alias for route dependency
CurrentUser = str
