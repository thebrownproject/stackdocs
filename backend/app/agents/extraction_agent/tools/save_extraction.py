"""
Tool: save_extraction (WRITE)

Writes extracted fields and confidence scores directly to the extractions table.
Validates data structure before saving.
"""

import json
from supabase import Client
from claude_agent_sdk import tool


def create_save_extraction_tool(extraction_id: str, user_id: str, db: Client):
    """Create save_extraction tool scoped to specific extraction and user."""

    @tool(
        "save_extraction",
        "Save extracted fields and confidence scores to database",
        {"fields": dict, "confidences": dict}
    )
    async def save_extraction(args: dict) -> dict:
        """Write extraction to database."""
        fields = args.get("fields", {})
        confidences = args.get("confidences", {})

        # Handle JSON strings (Claude sometimes stringifies)
        if isinstance(fields, str):
            try:
                fields = json.loads(fields)
            except json.JSONDecodeError:
                pass
        if isinstance(confidences, str):
            try:
                confidences = json.loads(confidences)
            except json.JSONDecodeError:
                pass

        if not fields:
            return {
                "content": [{"type": "text", "text": "No fields provided"}],
                "is_error": True
            }

        # Validate confidences are 0-1
        for key, conf in confidences.items():
            if not isinstance(conf, (int, float)) or not 0 <= conf <= 1:
                return {
                    "content": [{"type": "text", "text": f"Confidence for '{key}' must be 0.0-1.0, got {conf}"}],
                    "is_error": True
                }

        db.table("extractions").update({
            "extracted_fields": fields,
            "confidence_scores": confidences,
            "status": "in_progress",
        }).eq("id", extraction_id).eq("user_id", user_id).execute()

        return {
            "content": [{"type": "text", "text": f"Saved {len(fields)} fields to database"}]
        }

    return save_extraction
