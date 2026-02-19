"""
Usage tracking service for document processing limits.

Handles checking, incrementing, and resetting monthly usage quotas.
"""

import logging
from datetime import datetime, timezone
from typing import TypedDict

from fastapi import HTTPException

from ..database import get_supabase_client

logger = logging.getLogger(__name__)


class UsageStats(TypedDict):
    """User's current usage statistics."""
    documents_processed_this_month: int
    documents_limit: int
    subscription_tier: str
    usage_reset_date: str


def _parse_reset_date(date_str: str) -> datetime:
    """Parse reset date string to timezone-aware datetime.

    Handles both old format (date only: 2025-01-01) and
    new format (full datetime: 2025-01-01T00:00:00+00:00).
    """
    parsed = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    # If parsed datetime is naive (no timezone), assume UTC
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _get_next_reset_date() -> str:
    """Calculate the first day of next month as ISO datetime string with timezone."""
    now = datetime.now(timezone.utc)
    if now.month == 12:
        next_month = now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        next_month = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)
    return next_month.isoformat()


async def _get_user(user_id: str, fields: str = "*") -> dict:
    """
    Fetch user data from database.

    Raises:
        HTTPException: If user not found
    """
    supabase = get_supabase_client()
    response = supabase.table("users").select(fields).eq("id", user_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="User not found")

    return response.data[0]


async def check_usage_limit(user_id: str) -> bool:
    """
    Check if user can upload another document.

    Automatically resets usage counter if past reset date.

    Args:
        user_id: User UUID

    Returns:
        True if user is under their limit, False otherwise

    Raises:
        HTTPException: If user not found or database error
    """
    try:
        user = await _get_user(user_id)

        # Check if usage needs reset
        reset_date = _parse_reset_date(user["usage_reset_date"])
        if datetime.now(timezone.utc) >= reset_date:
            await reset_usage(user_id)
            logger.info(f"Reset usage for user {user_id}")
            return True

        # Check if under limit
        processed = user["documents_processed_this_month"]
        limit = user["documents_limit"]
        can_upload = processed < limit

        if not can_upload:
            logger.info(f"User {user_id} at limit: {processed}/{limit}")

        return can_upload

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Usage check failed for {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Usage check failed: {e}") from e


async def increment_usage(user_id: str) -> int:
    """
    Increment user's document count after successful processing.

    Args:
        user_id: User UUID

    Returns:
        New document count

    Raises:
        HTTPException: If user not found or database error
    """
    try:
        user = await _get_user(user_id, "documents_processed_this_month")
        new_count = user["documents_processed_this_month"] + 1

        supabase = get_supabase_client()
        supabase.table("users").update({
            "documents_processed_this_month": new_count
        }).eq("id", user_id).execute()

        logger.info(f"Incremented usage for user {user_id}: {new_count}")
        return new_count

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Usage increment failed for {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Usage increment failed: {e}") from e


async def reset_usage(user_id: str) -> None:
    """
    Reset user's monthly usage counter and set next reset date.

    Args:
        user_id: User UUID

    Raises:
        HTTPException: If database error occurs
    """
    try:
        supabase = get_supabase_client()
        supabase.table("users").update({
            "documents_processed_this_month": 0,
            "usage_reset_date": _get_next_reset_date()
        }).eq("id", user_id).execute()

        logger.info(f"Reset monthly usage for user {user_id}")

    except Exception as e:
        logger.error(f"Usage reset failed for {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Usage reset failed: {e}") from e


async def get_usage_stats(user_id: str) -> UsageStats:
    """
    Get user's current usage statistics.

    Args:
        user_id: User UUID

    Returns:
        UsageStats with current usage, limit, tier, and reset date

    Raises:
        HTTPException: If user not found or database error
    """
    try:
        user = await _get_user(
            user_id,
            "documents_processed_this_month, documents_limit, subscription_tier, usage_reset_date"
        )
        return UsageStats(
            documents_processed_this_month=user["documents_processed_this_month"],
            documents_limit=user["documents_limit"],
            subscription_tier=user["subscription_tier"],
            usage_reset_date=user["usage_reset_date"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get usage stats for {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get usage stats: {e}") from e
