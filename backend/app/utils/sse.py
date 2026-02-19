"""Shared SSE utilities."""

import json
from typing import Any


def sse_event(data: dict[str, Any]) -> str:
    """Format data as SSE event."""
    return f"data: {json.dumps(data)}\n\n"
