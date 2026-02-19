"""
Extraction Agent - Agentic document data extraction.

Uses Claude Agent SDK with tools that perform real database operations.
"""

from .agent import extract_with_agent, correct_with_session
from .prompts import EXTRACTION_SYSTEM_PROMPT, CORRECTION_PROMPT_TEMPLATE

__all__ = [
    "extract_with_agent",
    "correct_with_session",
    "EXTRACTION_SYSTEM_PROMPT",
    "CORRECTION_PROMPT_TEMPLATE",
]
