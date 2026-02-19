# Extraction Agent - Implementation Plan

> **Status:** Backend Complete (all 16 tasks done)
> **Completed:** 2025-12-22

**Goal:** Rebuild extraction agent with proper agentic architecture where tools perform real database operations.

**Architecture:** Agent reads OCR via tool, writes extractions via tools with validation. Direct DB writes for crash recovery and observability. Multi-tenant scoping via closure pattern in each tool file.

**Tech Stack:** Claude Agent SDK, FastAPI, Supabase PostgreSQL, SSE streaming

**Design Doc:** `2025-12-20-extraction-agent-design.md`
**Architecture Reference:** `Agentic-Tool-Redesign.md`

---

## Problems Being Fixed

| Issue | Current Code | Correct Behavior |
|-------|--------------|------------------|
| TextBlock misused | Treated as "thinking" | User-facing response |
| Dummy tool | Returns static message | Performs real DB operations |
| Data via interception | Captures `block.input` | Tool does the work |
| OCR in prompt | Stuffed into prompt | Agent reads via tool |

---

## Folder Structure

```
backend/app/agents/extraction_agent/
├── __init__.py
├── agent.py              # Main agent logic
├── prompts.py            # System prompts
└── tools/
    ├── __init__.py       # Exports create_tools() function
    ├── read_ocr.py       # READ from ocr_results
    ├── read_extraction.py # READ from extractions
    ├── save_extraction.py # WRITE to extractions
    ├── set_field.py      # WRITE with jsonb_set
    ├── delete_field.py   # DELETE from JSONB
    └── complete.py       # WRITE status
```

---

## Task 1: Add Status Column to Extractions

**Files:**
- Create: `backend/migrations/006_add_extraction_status.sql`
- Modify: `docs/SCHEMA.md`

**Step 1: Create migration file**

```sql
-- Migration 006: Add status column to extractions
-- Enables agent workflow: pending → in_progress → completed/failed

ALTER TABLE extractions
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed';

-- Set existing records to 'completed' (they were successful extractions)
UPDATE extractions SET status = 'completed' WHERE status IS NULL;

-- Add check constraint
ALTER TABLE extractions
ADD CONSTRAINT extractions_status_check
CHECK (status IN ('pending', 'in_progress', 'completed', 'failed'));

COMMENT ON COLUMN extractions.status IS 'Extraction status: pending, in_progress, completed, failed';
```

**Step 2: Apply migration to Supabase**

Run in Supabase SQL Editor.

**Step 3: Update SCHEMA.md**

Add `status VARCHAR(20) DEFAULT 'completed'` to the extractions table definition.

**Step 4: Commit**

```bash
git add backend/migrations/006_add_extraction_status.sql docs/SCHEMA.md
git commit -m "feat: add status column to extractions table"
```

---

## Task 2: Create Postgres RPC Functions

**Files:**
- Create: `backend/migrations/007_add_extraction_rpc_functions.sql`

**Step 1: Create migration with RPC functions**

```sql
-- Migration 007: RPC functions for extraction field updates
-- Used by agent tools for surgical JSONB updates

-- Function: Update a field at a JSON path
CREATE OR REPLACE FUNCTION update_extraction_field(
    p_extraction_id UUID,
    p_user_id UUID,
    p_field_path TEXT[],
    p_value JSONB,
    p_confidence FLOAT
) RETURNS VOID AS $$
BEGIN
    UPDATE extractions
    SET
        extracted_fields = jsonb_set(
            COALESCE(extracted_fields, '{}'::jsonb),
            p_field_path,
            p_value,
            true  -- create_if_missing
        ),
        confidence_scores = jsonb_set(
            COALESCE(confidence_scores, '{}'::jsonb),
            p_field_path,
            to_jsonb(p_confidence),
            true
        ),
        updated_at = NOW()
    WHERE id = p_extraction_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Remove a field at a JSON path
CREATE OR REPLACE FUNCTION remove_extraction_field(
    p_extraction_id UUID,
    p_user_id UUID,
    p_field_path TEXT[]
) RETURNS VOID AS $$
BEGIN
    UPDATE extractions
    SET
        extracted_fields = extracted_fields #- p_field_path,
        confidence_scores = confidence_scores #- p_field_path,
        updated_at = NOW()
    WHERE id = p_extraction_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION update_extraction_field TO authenticated;
GRANT EXECUTE ON FUNCTION remove_extraction_field TO authenticated;
```

**Step 2: Apply migration to Supabase**

Run in Supabase SQL Editor.

**Step 3: Commit**

```bash
git add backend/migrations/007_add_extraction_rpc_functions.sql
git commit -m "feat: add RPC functions for extraction field updates"
```

---

## Task 3: Implement read_ocr Tool

**Files:**
- Modify: `backend/app/agents/extraction_agent/tools/read_ocr.py`

**Step 1: Implement the tool**

```python
"""
Tool: read_ocr (READ)

Reads OCR text from the ocr_results table.
Scoped to the current document_id and user_id.
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
```

**Step 2: Commit**

```bash
git add backend/app/agents/extraction_agent/tools/read_ocr.py
git commit -m "feat: implement read_ocr tool"
```

---

## Task 4: Implement read_extraction Tool

**Files:**
- Modify: `backend/app/agents/extraction_agent/tools/read_extraction.py`

**Step 1: Implement the tool**

```python
"""
Tool: read_extraction (READ)

Reads current extraction state from the extractions table.
Used by agent to see what's been extracted so far.
"""

import json
from supabase import Client
from claude_agent_sdk import tool


def create_read_extraction_tool(extraction_id: str, db: Client):
    """Create read_extraction tool scoped to specific extraction."""

    @tool("read_extraction", "View the current extraction state", {})
    async def read_extraction(args: dict) -> dict:
        """Read current extraction from extractions table."""
        result = db.table("extractions") \
            .select("extracted_fields, confidence_scores, status") \
            .eq("id", extraction_id) \
            .single() \
            .execute()

        if not result.data:
            return {
                "content": [{"type": "text", "text": "No extraction found"}],
                "is_error": True
            }

        return {
            "content": [{"type": "text", "text": json.dumps(result.data, indent=2)}]
        }

    return read_extraction
```

**Step 2: Commit**

```bash
git add backend/app/agents/extraction_agent/tools/read_extraction.py
git commit -m "feat: implement read_extraction tool"
```

---

## Task 5: Implement save_extraction Tool

**Files:**
- Modify: `backend/app/agents/extraction_agent/tools/save_extraction.py`

**Step 1: Implement the tool**

```python
"""
Tool: save_extraction (WRITE)

Writes extracted fields and confidence scores directly to the extractions table.
Validates data structure before saving.
"""

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
            "updated_at": "now()"
        }).eq("id", extraction_id).eq("user_id", user_id).execute()

        return {
            "content": [{"type": "text", "text": f"Saved {len(fields)} fields to database"}]
        }

    return save_extraction
```

**Step 2: Commit**

```bash
git add backend/app/agents/extraction_agent/tools/save_extraction.py
git commit -m "feat: implement save_extraction tool"
```

---

## Task 6: Implement set_field Tool

**Files:**
- Modify: `backend/app/agents/extraction_agent/tools/set_field.py`

**Step 1: Implement the tool**

```python
"""
Tool: set_field (WRITE)

Updates a specific field at a JSON path using Postgres jsonb_set.
Supports nested paths like 'vendor.name' or 'items[0].price'.
"""

import json
from typing import Any
from supabase import Client
from claude_agent_sdk import tool


def parse_json_path(path: str) -> list[str]:
    """
    Convert JSON path string to Postgres array format.

    Examples:
        "vendor.name" → ["vendor", "name"]
        "items[2].price" → ["items", "2", "price"]
        "total" → ["total"]
    """
    # Replace [N] with .N
    normalized = path.replace("[", ".").replace("]", "")
    # Split on dots, filter empty
    return [p for p in normalized.split(".") if p]


def create_set_field_tool(extraction_id: str, user_id: str, db: Client):
    """Create set_field tool scoped to specific extraction and user."""

    @tool(
        "set_field",
        "Update a specific field using JSON path (e.g., 'vendor.name', 'items[0].price')",
        {"path": str, "value": Any, "confidence": float}
    )
    async def set_field(args: dict) -> dict:
        """Update field at JSON path using Postgres RPC."""
        path = args.get("path", "")
        value = args.get("value")
        confidence = args.get("confidence", 0.8)

        if not path:
            return {
                "content": [{"type": "text", "text": "Path is required"}],
                "is_error": True
            }

        if not 0 <= confidence <= 1:
            return {
                "content": [{"type": "text", "text": f"Confidence must be 0.0-1.0, got {confidence}"}],
                "is_error": True
            }

        pg_path = parse_json_path(path)

        db.rpc("update_extraction_field", {
            "p_extraction_id": extraction_id,
            "p_user_id": user_id,
            "p_field_path": pg_path,
            "p_value": json.dumps(value),
            "p_confidence": confidence
        }).execute()

        return {
            "content": [{"type": "text", "text": f"Updated '{path}' = {value} (confidence: {confidence})"}]
        }

    return set_field
```

**Step 2: Commit**

```bash
git add backend/app/agents/extraction_agent/tools/set_field.py
git commit -m "feat: implement set_field tool with JSON path support"
```

---

## Task 7: Implement delete_field Tool

**Files:**
- Modify: `backend/app/agents/extraction_agent/tools/delete_field.py`

**Step 1: Implement the tool**

```python
"""
Tool: delete_field (WRITE)

Removes a field at a JSON path using Postgres #- operator.
Supports nested paths like 'vendor.name' or 'items[0]'.
"""

from supabase import Client
from claude_agent_sdk import tool

from .set_field import parse_json_path


def create_delete_field_tool(extraction_id: str, user_id: str, db: Client):
    """Create delete_field tool scoped to specific extraction and user."""

    @tool(
        "delete_field",
        "Remove a field at JSON path",
        {"path": str}
    )
    async def delete_field(args: dict) -> dict:
        """Remove field at JSON path using Postgres RPC."""
        path = args.get("path", "")

        if not path:
            return {
                "content": [{"type": "text", "text": "Path is required"}],
                "is_error": True
            }

        pg_path = parse_json_path(path)

        db.rpc("remove_extraction_field", {
            "p_extraction_id": extraction_id,
            "p_user_id": user_id,
            "p_field_path": pg_path
        }).execute()

        return {
            "content": [{"type": "text", "text": f"Removed field at '{path}'"}]
        }

    return delete_field
```

**Step 2: Commit**

```bash
git add backend/app/agents/extraction_agent/tools/delete_field.py
git commit -m "feat: implement delete_field tool"
```

---

## Task 8: Implement complete Tool

**Files:**
- Modify: `backend/app/agents/extraction_agent/tools/complete.py`

**Step 1: Implement the tool**

```python
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
            "updated_at": "now()"
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
```

**Step 2: Commit**

```bash
git add backend/app/agents/extraction_agent/tools/complete.py
git commit -m "feat: implement complete tool"
```

---

## Task 9: Update Tools __init__.py

**Files:**
- Modify: `backend/app/agents/extraction_agent/tools/__init__.py`

**Step 1: Create create_tools function that assembles all tools**

```python
"""
Extraction agent tools.

Each tool performs a real action with validation.
Tools are registered with the MCP server for agent use.
"""

from supabase import Client

from .read_ocr import create_read_ocr_tool
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
```

**Step 2: Commit**

```bash
git add backend/app/agents/extraction_agent/tools/__init__.py
git commit -m "feat: add create_tools function to assemble extraction tools"
```

---

## Task 10: Implement System Prompts

**Files:**
- Modify: `backend/app/agents/extraction_agent/prompts.py`

**Step 1: Add system prompts**

```python
"""
System prompts for the extraction agent.

Contains:
- EXTRACTION_SYSTEM_PROMPT - Main agent instructions
- CORRECTION_PROMPT_TEMPLATE - For user corrections
"""

EXTRACTION_SYSTEM_PROMPT = """You are an expert document data extraction agent.

## Available Tools

**Read:**
- `read_ocr` - Read the OCR text from the document
- `read_extraction` - View what's been extracted so far

**Write:**
- `save_extraction` - Save extracted fields and confidence scores
- `set_field` - Update a specific field (supports nested paths like 'vendor.name')
- `delete_field` - Remove an incorrectly extracted field
- `complete` - Mark extraction as complete

## Workflow

1. Use `read_ocr` to read the document
2. Analyze the content and identify the document type
3. Use `save_extraction` to save your extraction
4. Use `complete` when done
5. Summarize what you extracted for the user

## Guidelines

- Extract ALL relevant fields using rich nested structures
- Assign honest confidence scores (0.0-1.0)
- Only extract data explicitly present - don't guess
- Use appropriate types (numbers for amounts, arrays for line items)

## For Corrections

When the user provides corrections:
1. Use `read_extraction` to see current state
2. Use `set_field` with the path to fix specific fields
3. Use `delete_field` if something shouldn't be there
4. Summarize what you changed

Always end by summarizing what you extracted or changed.
"""


CORRECTION_PROMPT_TEMPLATE = """The user has provided a correction to the extraction:

{instruction}

Please update the extraction accordingly:
1. First use read_extraction to see the current state
2. Use set_field or delete_field to make the corrections
3. Summarize what you changed
"""
```

**Step 2: Commit**

```bash
git add backend/app/agents/extraction_agent/prompts.py
git commit -m "feat: add extraction agent system prompts"
```

---

## Task 11: Implement Agent Core

**Files:**
- Modify: `backend/app/agents/extraction_agent/agent.py`

**Step 1: Implement the agent with correct SSE streaming**

```python
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
    custom_fields: list[str] | None = None
) -> AsyncIterator[dict[str, Any]]:
    """
    Extract data using Agent SDK with streaming.

    Args:
        extraction_id: Pre-created extraction record ID
        document_id: Document to extract from
        user_id: User who owns the document
        db: Supabase client
        mode: "auto" for automatic extraction, "custom" for specific fields
        custom_fields: List of field names (required if mode="custom")

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
        fields_str = ", ".join(custom_fields or [])
        task_prompt = f"Extract these specific fields from the document: {fields_str}"

    task_prompt += "\n\nStart by using read_ocr to read the document text."

    options = ClaudeAgentOptions(
        system=EXTRACTION_SYSTEM_PROMPT,
        mcp_servers={"extraction": extraction_server},
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
```

**Step 2: Commit**

```bash
git add backend/app/agents/extraction_agent/agent.py
git commit -m "feat: implement extraction agent with correct SSE streaming"
```

---

## Task 12: Update Agent __init__.py

**Files:**
- Modify: `backend/app/agents/extraction_agent/__init__.py`

**Step 1: Export agent functions**

```python
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
```

**Step 2: Commit**

```bash
git add backend/app/agents/extraction_agent/__init__.py
git commit -m "chore: export agent functions from extraction_agent module"
```

---

## Task 13: Update Agent Routes

**Files:**
- Modify: `backend/app/routes/agent.py`

**Step 1: Update routes to use new agent**

```python
"""
Agent SDK routes - streaming extraction endpoints.

Endpoints:
- POST /api/agent/extract - Extract with streaming
- POST /api/agent/correct - Correct extraction with session resume
- GET /api/agent/health - Health check
"""

import json
import logging
import time
from typing import AsyncIterator

from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import StreamingResponse

from ..agents.extraction_agent import extract_with_agent, correct_with_session
from ..database import get_supabase_client

router = APIRouter()
logger = logging.getLogger(__name__)


def sse_event(data: dict) -> str:
    """Format data as SSE event."""
    return f"data: {json.dumps(data)}\n\n"


@router.post("/extract")
async def extract_with_streaming(
    document_id: str = Form(...),
    user_id: str = Form(...),
    mode: str = Form("auto"),
    custom_fields: str | None = Form(None),
):
    """
    Extract from document with SSE streaming.

    Creates extraction record first, then runs agent.
    Agent writes directly to database via tools.

    Args:
        document_id: Document UUID (must have OCR cached)
        user_id: User UUID
        mode: "auto" or "custom"
        custom_fields: Comma-separated field names (required if mode=custom)

    Returns:
        SSE stream with events:
        - {"text": "..."} - Claude's response
        - {"tool": "...", "input": {...}} - Tool activity
        - {"complete": true, "extraction_id": "...", "session_id": "..."}
        - {"error": "..."}
    """
    if mode not in ["auto", "custom"]:
        raise HTTPException(status_code=400, detail="Mode must be 'auto' or 'custom'")

    if mode == "custom" and not custom_fields:
        raise HTTPException(status_code=400, detail="custom_fields required for custom mode")

    supabase = get_supabase_client()

    # Verify document exists and has OCR
    doc = supabase.table("documents").select("id").eq("id", document_id).eq("user_id", user_id).single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    ocr = supabase.table("ocr_results").select("id").eq("document_id", document_id).single().execute()
    if not ocr.data:
        raise HTTPException(status_code=400, detail="No cached OCR. Process document first.")

    # Parse custom fields
    fields_list: list[str] | None = None
    if custom_fields:
        fields_list = [f.strip() for f in custom_fields.split(",") if f.strip()]

    # Create extraction record BEFORE starting agent
    start_time = time.time()
    extraction = supabase.table("extractions").insert({
        "document_id": document_id,
        "user_id": user_id,
        "extracted_fields": {},  # Agent will populate via tools
        "confidence_scores": {},
        "mode": mode,
        "custom_fields": fields_list,
        "model": "claude-agent-sdk",
        "processing_time_ms": 0,  # Will update on completion
        "status": "in_progress"
    }).execute()

    extraction_id = extraction.data[0]["id"]

    async def event_stream() -> AsyncIterator[str]:
        """Generate SSE events from extraction."""
        try:
            async for event in extract_with_agent(
                extraction_id=extraction_id,
                document_id=document_id,
                user_id=user_id,
                db=supabase,
                mode=mode,
                custom_fields=fields_list
            ):
                if "complete" in event:
                    # Update processing time
                    processing_time_ms = int((time.time() - start_time) * 1000)
                    supabase.table("extractions").update({
                        "processing_time_ms": processing_time_ms
                    }).eq("id", extraction_id).execute()

                    # Store session_id on document for future corrections
                    if event.get("session_id"):
                        supabase.table("documents").update({
                            "session_id": event["session_id"]
                        }).eq("id", document_id).execute()

                    event["processing_time_ms"] = processing_time_ms

                yield sse_event(event)

        except Exception as e:
            logger.error(f"Extraction stream error: {e}")
            yield sse_event({"error": str(e)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.post("/correct")
async def correct_extraction(
    document_id: str = Form(...),
    user_id: str = Form(...),
    instruction: str = Form(...),
):
    """
    Correct extraction using session resume.

    Args:
        document_id: Document UUID
        user_id: User UUID
        instruction: Correction instruction

    Returns:
        SSE stream with same event types as /extract
    """
    supabase = get_supabase_client()

    # Get document with session_id
    doc = supabase.table("documents").select("session_id").eq("id", document_id).eq("user_id", user_id).single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    session_id = doc.data.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="No session found. Extract first.")

    # Get latest extraction
    extraction = supabase.table("extractions") \
        .select("id, mode, custom_fields") \
        .eq("document_id", document_id) \
        .order("created_at", desc=True) \
        .limit(1) \
        .single() \
        .execute()

    if not extraction.data:
        raise HTTPException(status_code=400, detail="No extraction found")

    extraction_id = extraction.data["id"]

    async def event_stream() -> AsyncIterator[str]:
        """Generate SSE events from correction."""
        try:
            async for event in correct_with_session(
                session_id=session_id,
                extraction_id=extraction_id,
                document_id=document_id,
                user_id=user_id,
                instruction=instruction,
                db=supabase
            ):
                yield sse_event(event)

        except Exception as e:
            logger.error(f"Correction stream error: {e}")
            yield sse_event({"error": str(e)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/health")
async def agent_health():
    """Check Agent SDK endpoints are available."""
    return {
        "status": "ok",
        "sdk": "claude-agent-sdk",
        "endpoints": ["/api/agent/extract", "/api/agent/correct"],
        "architecture": "agentic-tools"
    }
```

**Step 2: Commit**

```bash
git add backend/app/routes/agent.py
git commit -m "feat: update routes to use new agentic extraction"
```

---

## Task 14: Integration Test

**Files:**
- Use: Swagger UI at `/docs`

**Step 1: Apply migrations**

Run migrations 006 and 007 in Supabase SQL Editor.

**Step 2: Start backend**

```bash
cd backend
uv run uvicorn app.main:app --reload --port 8001
```

**Step 3: Test extract endpoint**

Use Swagger UI to call `POST /api/agent/extract`:
- document_id: (use an existing document with OCR)
- user_id: (matching user)
- mode: "auto"

**Step 4: Verify SSE events**

Check that events are:
- `{"text": "..."}` - NOT `{"type": "thinking", "text": "..."}`
- `{"tool": "...", "input": {...}}`
- `{"complete": true, ...}`

**Step 5: Verify database**

Check extractions table:
- status = "completed"
- extracted_fields populated
- confidence_scores populated

**Step 6: Test correction endpoint**

Call `POST /api/agent/correct`:
- document_id: same document
- user_id: same user
- instruction: "Change the vendor name to 'Test Corp'"

**Step 7: Commit test notes**

```bash
git commit --allow-empty -m "test: verified agentic extraction via Swagger UI"
```

---

## Task 15: Cleanup Old Implementation

**Files:**
- Delete: `backend/app/services/agent_extractor.py`

**Step 1: Verify new implementation works**

Run through Task 14 completely.

**Step 2: Delete old file**

```bash
rm backend/app/services/agent_extractor.py
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete old agent_extractor.py (replaced by agents/extraction_agent/)"
```

---

## Task 16: Update Design Doc Status

**Files:**
- Modify: `docs/plans/in-progress/extraction-agent/2025-12-20-extraction-agent-design.md`

**Step 1: Update status**

Change:
- Status: In Progress → Backend Complete
- Remove "Dummy Extraction Tool: Working"
- Add "Agentic Tools: Implemented"

**Step 2: Commit**

```bash
git add docs/plans/in-progress/extraction-agent/2025-12-20-extraction-agent-design.md
git commit -m "docs: update extraction agent design status"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add status column | Migration 006 |
| 2 | Create RPC functions | Migration 007 |
| 3 | Implement read_ocr | tools/read_ocr.py |
| 4 | Implement read_extraction | tools/read_extraction.py |
| 5 | Implement save_extraction | tools/save_extraction.py |
| 6 | Implement set_field | tools/set_field.py |
| 7 | Implement delete_field | tools/delete_field.py |
| 8 | Implement complete | tools/complete.py |
| 9 | Update tools __init__ | tools/__init__.py |
| 10 | Implement prompts | prompts.py |
| 11 | Implement agent core | agent.py |
| 12 | Update agent __init__ | __init__.py |
| 13 | Update routes | routes/agent.py |
| 14 | Integration test | Swagger UI |
| 15 | Cleanup old code | agent_extractor.py |
| 16 | Update design doc | design.md |

---

## Notes

- SSE events use flat objects with keys: `text`, `tool`, `complete`, `error`
- Frontend checks which key exists to determine event type
- TextBlock = Claude's user-facing response (NOT "thinking")
- Tools perform real DB operations with validation
- Multi-tenant security via tool scoping at creation time
- Each tool in its own file, create_tools() assembles them
