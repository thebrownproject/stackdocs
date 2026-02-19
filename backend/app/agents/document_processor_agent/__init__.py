"""
Document processor agent for metadata generation.

Generates display_name, tags, and summary from OCR text.
"""

from .agent import process_document_metadata

__all__ = ["process_document_metadata"]
