"""
Tool: delete_field (WRITE)

Removes a field at a JSON path using Postgres #- operator.
Supports nested paths like 'vendor.name' or 'items[0]'.
"""

from supabase import Client
from claude_agent_sdk import tool

from .set_field import parse_json_path


def create_delete_field_tool(extraction_id: str, user_id: str, db: Client):
    """Create delete_field tool scoped to specific extraction and user."""

    @tool(
        "delete_field",
        "Remove a field at JSON path",
        {"path": str}
    )
    async def delete_field(args: dict) -> dict:
        """Remove field at JSON path using Postgres RPC."""
        path = args.get("path", "")

        if not path:
            return {
                "content": [{"type": "text", "text": "Path is required"}],
                "is_error": True
            }

        pg_path = parse_json_path(path)

        db.rpc("remove_extraction_field", {
            "p_extraction_id": extraction_id,
            "p_user_id": user_id,
            "p_field_path": pg_path
        }).execute()

        return {
            "content": [{"type": "text", "text": f"Removed field at '{path}'"}]
        }

    return delete_field
