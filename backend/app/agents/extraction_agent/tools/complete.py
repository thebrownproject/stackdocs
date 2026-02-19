"""
Tool: complete (WRITE)

Marks extraction as complete and updates document status.
Validates that extraction has data before completing.
"""

from supabase import Client
from claude_agent_sdk import tool


def create_complete_tool(extraction_id: str, document_id: str, user_id: str, db: Client):
    """Create complete tool scoped to specific extraction, document, and user."""

    @tool("complete", "Mark extraction as complete", {})
    async def complete(args: dict) -> dict:
        """Mark extraction as completed."""
        # Verify extraction has data
        current = db.table("extractions") \
            .select("extracted_fields") \
            .eq("id", extraction_id) \
            .single() \
            .execute()

        if not current.data or not current.data.get("extracted_fields"):
            return {
                "content": [{"type": "text", "text": "Cannot complete: no fields extracted"}],
                "is_error": True
            }

        db.table("extractions").update({
            "status": "completed",
        }).eq("id", extraction_id).eq("user_id", user_id).execute()

        # Also update document status
        db.table("documents").update({
            "status": "completed"
        }).eq("id", document_id).eq("user_id", user_id).execute()

        field_count = len(current.data["extracted_fields"])
        return {
            "content": [{"type": "text", "text": f"Extraction complete. {field_count} fields saved."}]
        }

    return complete
