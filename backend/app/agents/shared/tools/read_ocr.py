"""
Shared Tool: read_ocr (READ)

Reads OCR text from the ocr_results table.
Scoped to the current document_id and user_id.

Used by:
- extraction_agent
- document_processor_agent
"""

from supabase import Client
from claude_agent_sdk import tool


def create_read_ocr_tool(document_id: str, user_id: str, db: Client):
    """Create read_ocr tool scoped to specific document and user."""

    @tool("read_ocr", "Read the OCR text from the document", {})
    async def read_ocr(args: dict) -> dict:
        """Read OCR text from ocr_results table."""
        result = db.table("ocr_results") \
            .select("raw_text") \
            .eq("document_id", document_id) \
            .eq("user_id", user_id) \
            .single() \
            .execute()

        if not result.data:
            return {
                "content": [{"type": "text", "text": "No OCR data found for this document"}],
                "is_error": True
            }

        return {
            "content": [{
                "type": "text",
                "text": result.data["raw_text"]
            }]
        }

    return read_ocr
