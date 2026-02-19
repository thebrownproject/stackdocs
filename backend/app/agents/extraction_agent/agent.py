"""
Main extraction agent logic.

Functions:
- extract_with_agent() - Initial extraction from OCR text
- correct_with_session() - Resume session for user corrections
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
    ResultMessage,
)
from supabase import Client

from .prompts import EXTRACTION_SYSTEM_PROMPT, CORRECTION_PROMPT_TEMPLATE
from .tools import create_tools

logger = logging.getLogger(__name__)


async def extract_with_agent(
    extraction_id: str,
    document_id: str,
    user_id: str,
    db: Client,
    mode: str = "auto",
    custom_fields: list[dict] | list[str] | None = None
) -> AsyncIterator[dict[str, Any]]:
    """
    Extract data using Agent SDK with streaming.

    Args:
        extraction_id: Pre-created extraction record ID
        document_id: Document to extract from
        user_id: User who owns the document
        db: Supabase client
        mode: "auto" for automatic extraction, "custom" for specific fields
        custom_fields: List of field names or field objects with name/description
                       (required if mode="custom")

    Yields:
        {"text": "..."} - Claude's user-facing response
        {"tool": "...", "input": {...}} - Tool activity
        {"complete": True, "extraction_id": "...", "session_id": "..."} - Done
        {"error": "..."} - Error occurred
    """
    # Create scoped tools
    tools = create_tools(extraction_id, document_id, user_id, db)

    # Create MCP server with tools
    extraction_server = create_sdk_mcp_server(
        name="extraction",
        tools=tools
    )

    # Build task prompt
    if mode == "auto":
        task_prompt = "Extract all relevant data from this document."
    else:
        # Format custom fields - handle both string and object formats
        if custom_fields:
            fields_text = []
            for field in custom_fields:
                if isinstance(field, dict):
                    name = field.get('name', '')
                    desc = field.get('description', '')
                    if desc:
                        fields_text.append(f"- {name}: {desc}")
                    else:
                        fields_text.append(f"- {name}")
                else:
                    fields_text.append(f"- {field}")
            fields_prompt = "\n".join(fields_text)
            task_prompt = f"Extract these specific fields from the document:\n{fields_prompt}"
        else:
            task_prompt = "Extract the requested fields from the document."

    task_prompt += "\n\nStart by using read_ocr to read the document text."

    options = ClaudeAgentOptions(
        system_prompt=EXTRACTION_SYSTEM_PROMPT,
        mcp_servers={"extraction": extraction_server},
        allowed_tools=[
            "mcp__extraction__read_ocr",
            "mcp__extraction__read_extraction",
            "mcp__extraction__save_extraction",
            "mcp__extraction__set_field",
            "mcp__extraction__delete_field",
            "mcp__extraction__complete",
        ],
        max_turns=5,  # read_ocr → analyze → save_extraction → complete → summarize
    )

    session_id: str | None = None

    try:
        async with ClaudeSDKClient(options=options) as client:
            await client.query(task_prompt)

            async for message in client.receive_response():
                if isinstance(message, ResultMessage):
                    session_id = message.session_id

                elif isinstance(message, AssistantMessage):
                    for block in message.content:
                        # TextBlock = Claude's user-facing response (NOT "thinking")
                        if isinstance(block, TextBlock):
                            yield {"text": block.text}

                        # ToolUseBlock = tool activity
                        elif isinstance(block, ToolUseBlock):
                            yield {"tool": block.name, "input": block.input}

            # Extraction complete
            yield {
                "complete": True,
                "extraction_id": extraction_id,
                "session_id": session_id
            }

    except Exception as e:
        logger.error(f"Extraction failed: {e}")

        # Mark extraction as failed
        db.table("extractions").update({
            "status": "failed"
        }).eq("id", extraction_id).execute()

        yield {"error": str(e)}


async def correct_with_session(
    session_id: str,
    extraction_id: str,
    document_id: str,
    user_id: str,
    instruction: str,
    db: Client
) -> AsyncIterator[dict[str, Any]]:
    """
    Resume session for correction based on user feedback.

    Args:
        session_id: Session ID from previous extraction
        extraction_id: Extraction record to update
        document_id: Document being corrected
        user_id: User who owns the document
        instruction: User's correction instruction
        db: Supabase client

    Yields:
        Same event types as extract_with_agent
    """
    # Create scoped tools
    tools = create_tools(extraction_id, document_id, user_id, db)

    extraction_server = create_sdk_mcp_server(
        name="extraction",
        tools=tools
    )

    options = ClaudeAgentOptions(
        resume=session_id,  # Resume previous conversation
        mcp_servers={"extraction": extraction_server},
        allowed_tools=[
            "mcp__extraction__read_ocr",
            "mcp__extraction__read_extraction",
            "mcp__extraction__save_extraction",
            "mcp__extraction__set_field",
            "mcp__extraction__delete_field",
            "mcp__extraction__complete",
        ],
        max_turns=3,
    )

    prompt = CORRECTION_PROMPT_TEMPLATE.format(instruction=instruction)

    try:
        async with ClaudeSDKClient(options=options) as client:
            await client.query(prompt)

            async for message in client.receive_response():
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if isinstance(block, TextBlock):
                            yield {"text": block.text}
                        elif isinstance(block, ToolUseBlock):
                            yield {"tool": block.name, "input": block.input}

            yield {
                "complete": True,
                "extraction_id": extraction_id,
                "session_id": session_id
            }

    except Exception as e:
        logger.error(f"Correction failed: {e}")
        yield {"error": str(e)}
