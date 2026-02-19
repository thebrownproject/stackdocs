"""
Tool: read_extraction (READ)

Reads current extraction state from the extractions table.
Used by agent to see what's been extracted so far.
"""

import json
from supabase import Client
from claude_agent_sdk import tool


def create_read_extraction_tool(extraction_id: str, db: Client):
    """Create read_extraction tool scoped to specific extraction."""

    @tool("read_extraction", "View the current extraction state", {})
    async def read_extraction(args: dict) -> dict:
        """Read current extraction from extractions table."""
        result = db.table("extractions") \
            .select("extracted_fields, confidence_scores, status") \
            .eq("id", extraction_id) \
            .single() \
            .execute()

        if not result.data:
            return {
                "content": [{"type": "text", "text": "No extraction found"}],
                "is_error": True
            }

        return {
            "content": [{"type": "text", "text": json.dumps(result.data, indent=2)}]
        }

    return read_extraction
