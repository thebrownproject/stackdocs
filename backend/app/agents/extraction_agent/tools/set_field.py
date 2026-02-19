"""
Tool: set_field (WRITE)

Updates a specific field at a JSON path using Postgres jsonb_set.
Supports nested paths like 'vendor.name' or 'items[0].price'.
"""

import json
from typing import Any
from supabase import Client
from claude_agent_sdk import tool


def parse_json_path(path: str) -> list[str]:
    """
    Convert JSON path string to Postgres array format.

    Examples:
        "vendor.name" → ["vendor", "name"]
        "items[2].price" → ["items", "2", "price"]
        "total" → ["total"]
    """
    # Replace [N] with .N
    normalized = path.replace("[", ".").replace("]", "")
    # Split on dots, filter empty
    return [p for p in normalized.split(".") if p]


def create_set_field_tool(extraction_id: str, user_id: str, db: Client):
    """Create set_field tool scoped to specific extraction and user."""

    @tool(
        "set_field",
        "Update a specific field using JSON path (e.g., 'vendor.name', 'items[0].price')",
        {"path": str, "value": Any, "confidence": float}
    )
    async def set_field(args: dict) -> dict:
        """Update field at JSON path using Postgres RPC."""
        path = args.get("path", "")
        value = args.get("value")
        confidence = args.get("confidence", 0.8)

        if not path:
            return {
                "content": [{"type": "text", "text": "Path is required"}],
                "is_error": True
            }

        if not 0 <= confidence <= 1:
            return {
                "content": [{"type": "text", "text": f"Confidence must be 0.0-1.0, got {confidence}"}],
                "is_error": True
            }

        pg_path = parse_json_path(path)

        # Parse value if it's a JSON string
        actual_value = value
        if isinstance(value, str):
            try:
                actual_value = json.loads(value)
            except json.JSONDecodeError:
                actual_value = value  # Keep as string if not valid JSON

        db.rpc("update_extraction_field", {
            "p_extraction_id": extraction_id,
            "p_user_id": user_id,
            "p_field_path": pg_path,
            "p_value": actual_value,  # Supabase handles JSONB serialization
            "p_confidence": confidence
        }).execute()

        return {
            "content": [{"type": "text", "text": f"Updated '{path}' = {value} (confidence: {confidence})"}]
        }

    return set_field
