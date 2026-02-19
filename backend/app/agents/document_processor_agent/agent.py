"""
Document processor agent for metadata generation.

Functions:
- process_document_metadata() - Generate metadata from OCR text
"""

import logging
from typing import Any, AsyncIterator

from claude_agent_sdk import (
    create_sdk_mcp_server,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    AssistantMessage,
    TextBlock,
    ToolUseBlock,
)
from supabase import Client

from .prompts import METADATA_SYSTEM_PROMPT
from .tools import create_tools

logger = logging.getLogger(__name__)


async def process_document_metadata(
    document_id: str,
    user_id: str,
    db: Client,
) -> AsyncIterator[dict[str, Any]]:
    """
    Generate document metadata using Agent SDK with streaming.

    Note: Unlike extraction_agent, this agent does NOT capture session_id.
    Metadata generation is a one-shot operation - users edit metadata
    directly in the UI rather than via agent corrections.

    Args:
        document_id: Document to process (must have OCR cached)
        user_id: User who owns the document
        db: Supabase client

    Yields:
        {"text": "..."} - Claude's response
        {"tool": "...", "input": {...}} - Tool activity
        {"complete": True} - Done
        {"error": "..."} - Error occurred
    """
    # Create scoped tools
    tools = create_tools(document_id, user_id, db)

    # Create MCP server with tools
    metadata_server = create_sdk_mcp_server(
        name="metadata",
        tools=tools
    )

    task_prompt = """Analyze this document and generate metadata.

Start by using read_ocr to read the document text, then use save_metadata to save the metadata you generate."""

    options = ClaudeAgentOptions(
        system_prompt=METADATA_SYSTEM_PROMPT,
        mcp_servers={"metadata": metadata_server},
        allowed_tools=[
            "mcp__metadata__read_ocr",
            "mcp__metadata__save_metadata",
        ],
        max_turns=10,  # Generous buffer for complex documents
    )

    try:
        async with ClaudeSDKClient(options=options) as client:
            await client.query(task_prompt)

            async for message in client.receive_response():
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if isinstance(block, TextBlock):
                            yield {"text": block.text}
                        elif isinstance(block, ToolUseBlock):
                            yield {"tool": block.name, "input": block.input}

        yield {"complete": True}

    except Exception as e:
        logger.error(f"Metadata generation failed for document {document_id}: {e}")
        yield {"error": str(e)}
