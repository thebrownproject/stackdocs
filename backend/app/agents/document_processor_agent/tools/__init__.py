"""
Document processor agent tools.

Tools are scoped to specific document context for security.
"""

from supabase import Client

from ...shared.tools import create_read_ocr_tool  # Use shared tool
from .save_metadata import create_save_metadata_tool


def create_tools(document_id: str, user_id: str, db: Client) -> list:
    """
    Create all metadata tools scoped to a specific context.

    All database queries are locked to the provided IDs.
    The agent cannot override these - multi-tenant security is enforced.
    """
    return [
        create_read_ocr_tool(document_id, user_id, db),
        create_save_metadata_tool(document_id, user_id, db),
    ]


__all__ = ["create_tools"]
