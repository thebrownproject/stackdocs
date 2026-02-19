"""
Tool: save_metadata (WRITE)

Writes display_name, tags, and summary to the documents table.
Validates data before saving.
"""

from supabase import Client
from claude_agent_sdk import tool


def create_save_metadata_tool(document_id: str, user_id: str, db: Client):
    """Create save_metadata tool scoped to specific document and user."""

    @tool(
        "save_metadata",
        "Save document metadata (display_name, tags, summary) to database",
        {
            "display_name": str,
            "tags": list,
            "summary": str
        }
    )
    async def save_metadata(_args: dict) -> dict:
        """Write metadata to documents table."""
        display_name = _args.get("display_name", "").strip()
        tags = _args.get("tags", [])
        summary = _args.get("summary", "").strip()

        # Validate display_name
        if not display_name:
            return {
                "content": [{"type": "text", "text": "display_name is required"}],
                "is_error": True
            }

        # Validate tags is a list of strings
        if not isinstance(tags, list):
            return {
                "content": [{"type": "text", "text": "tags must be a list"}],
                "is_error": True
            }

        # Clean tags: ensure all are non-empty strings
        cleaned_tags = []
        for tag in tags:
            if isinstance(tag, str) and tag.strip():
                cleaned_tags.append(tag.strip().lower())

        # Limit tags to 10 max
        cleaned_tags = cleaned_tags[:10]

        # Truncate summary if too long (200 chars max)
        if len(summary) > 200:
            summary = summary[:197] + "..."

        # Update document with metadata
        try:
            result = db.table("documents").update({
                "display_name": display_name,
                "tags": cleaned_tags,
                "summary": summary,
            }).eq("id", document_id).eq("user_id", user_id).execute()

            if not result.data:
                return {
                    "content": [{"type": "text", "text": "Error: Document not found or update failed"}],
                    "is_error": True
                }

        except Exception as e:
            return {
                "content": [{"type": "text", "text": f"Database error: {str(e)}"}],
                "is_error": True
            }

        return {
            "content": [{
                "type": "text",
                "text": f"Saved metadata: '{display_name}' with {len(cleaned_tags)} tags"
            }]
        }

    return save_metadata
