"""
Extraction agent tools.

Each tool performs a real action with validation.
Tools are registered with the MCP server for agent use.
"""

from supabase import Client

from ...shared.tools import create_read_ocr_tool  # Use shared tool
from .read_extraction import create_read_extraction_tool
from .save_extraction import create_save_extraction_tool
from .set_field import create_set_field_tool, parse_json_path
from .delete_field import create_delete_field_tool
from .complete import create_complete_tool


def create_tools(
    extraction_id: str,
    document_id: str,
    user_id: str,
    db: Client
) -> list:
    """
    Create all extraction tools scoped to a specific context.

    All database queries are locked to the provided IDs.
    The agent cannot override these - multi-tenant security is enforced.
    """
    return [
        create_read_ocr_tool(document_id, user_id, db),
        create_read_extraction_tool(extraction_id, db),
        create_save_extraction_tool(extraction_id, user_id, db),
        create_set_field_tool(extraction_id, user_id, db),
        create_delete_field_tool(extraction_id, user_id, db),
        create_complete_tool(extraction_id, document_id, user_id, db),
    ]


__all__ = ["create_tools", "parse_json_path"]
