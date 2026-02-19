# Phase 2: Backend Metadata Agent

**Feature:** Documents Redesign
**Phase:** 2 of N
**Scope:** New `document_processor_agent` for metadata generation
**Estimated Time:** 2-3 hours

---

## Overview

Create a new agent that analyzes OCR text and generates document metadata (display_name, tags, summary). This agent runs after OCR completes during the upload flow.

**Input:** `document_id` (document must have OCR cached)
**Output:** `{ display_name, tags, summary }` written to `documents` table

---

## Prerequisites

- Phase 1 complete (database migration with `display_name`, `tags`, `summary` columns)
- Existing `extraction_agent` pattern to copy from

---

## File Structure

Create new agent directory:

```
backend/app/agents/
├── extraction_agent/          # Existing (reference)
├── stack_agent/               # Existing (reference)
└── document_processor_agent/  # NEW
    ├── __init__.py            # Public exports
    ├── agent.py               # process_document_metadata()
    ├── prompts.py             # METADATA_SYSTEM_PROMPT
    ├── CLAUDE.md              # Agent documentation
    └── tools/
        ├── __init__.py        # create_tools()
        ├── read_ocr.py        # Read cached OCR text
        └── save_metadata.py   # Write metadata to documents table
```

---

## Tasks

### Task 1: Create Agent Directory Structure

**Files to create:**
- `backend/app/agents/document_processor_agent/__init__.py`
- `backend/app/agents/document_processor_agent/tools/__init__.py`

**`__init__.py` content:**
```python
"""
Document processor agent for metadata generation.

Generates display_name, tags, and summary from OCR text.
"""

from .agent import process_document_metadata

__all__ = ["process_document_metadata"]
```

**`tools/__init__.py` content:**
```python
"""
Document processor agent tools.

Tools are scoped to specific document context for security.
"""

from supabase import Client

from .read_ocr import create_read_ocr_tool
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
```

---

### Task 2: Create Shared `read_ocr` Tool (DRY)

**Why shared:** The `read_ocr` tool is identical in `extraction_agent` and this new agent. Extract to shared location to avoid duplication.

**Step 2a: Create shared tools directory**

```bash
mkdir -p backend/app/agents/shared/tools
touch backend/app/agents/shared/__init__.py
touch backend/app/agents/shared/tools/__init__.py
```

**Step 2b: Create shared read_ocr tool**

**File:** `backend/app/agents/shared/tools/read_ocr.py`

```python
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
```

**Step 2c: Export from shared tools**

**File:** `backend/app/agents/shared/tools/__init__.py`

```python
"""Shared agent tools."""

from .read_ocr import create_read_ocr_tool

__all__ = ["create_read_ocr_tool"]
```

**File:** `backend/app/agents/shared/__init__.py`

```python
"""Shared agent utilities and tools."""

from .tools import create_read_ocr_tool

__all__ = ["create_read_ocr_tool"]
```

**Step 2d: Update document_processor_agent to use shared tool**

**File:** `backend/app/agents/document_processor_agent/tools/__init__.py`

```python
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
```

**Step 2e: Update extraction_agent to use shared tool (optional cleanup)**

Update `backend/app/agents/extraction_agent/tools/__init__.py` to import from shared:
```python
from ...shared.tools import create_read_ocr_tool  # Use shared tool
```

Then delete `backend/app/agents/extraction_agent/tools/read_ocr.py`.

---

### Task 3: Create `save_metadata` Tool

**File:** `backend/app/agents/document_processor_agent/tools/save_metadata.py`

This tool writes metadata directly to the `documents` table.

```python
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
    async def save_metadata(args: dict) -> dict:
        """Write metadata to documents table."""
        display_name = args.get("display_name", "").strip()
        tags = args.get("tags", [])
        summary = args.get("summary", "").strip()

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

        # Truncate summary if too long (150 chars per design doc)
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
```

---

### Task 4: Create System Prompt

**File:** `backend/app/agents/document_processor_agent/prompts.py`

```python
"""
System prompts for the document processor agent.

Contains:
- METADATA_SYSTEM_PROMPT - Instructions for metadata generation
"""

METADATA_SYSTEM_PROMPT = """You are a document metadata extraction agent.

Your job is to analyze document text and generate helpful metadata that makes documents easy to find and understand.

## Available Tools

**Read:**
- `read_ocr` - Read the OCR text from the document

**Write:**
- `save_metadata` - Save display_name, tags, and summary to the document

## Workflow

1. Use `read_ocr` to read the document text
2. Analyze the content to understand what type of document this is
3. Generate metadata:
   - `display_name`: A descriptive filename (e.g., "Invoice - Acme Corp - March 2026.pdf")
   - `tags`: 3-5 relevant tags for filtering/search (e.g., ["invoice", "acme-corp", "$1,250"])
   - `summary`: 1-2 sentence description of the document content
4. Use `save_metadata` to save your analysis
5. Briefly confirm what you saved

## Guidelines for display_name

- Include document type (Invoice, Receipt, Contract, Report, etc.)
- Include key identifiers (company name, date, amount if relevant)
- Keep under 60 characters
- Use title case
- Include file extension (.pdf, .png, etc.)
- Example: "Invoice - Acme Corp - March 2026.pdf"

## Guidelines for tags

- Use lowercase
- Use hyphens for multi-word tags (e.g., "acme-corp" not "Acme Corp")
- Include document type as first tag
- Include key entities (company names, amounts, dates)
- 3-5 tags is ideal, max 10
- Be specific enough to be useful for filtering

## Guidelines for summary

- 1-2 sentences max (~150 characters)
- Focus on the key facts: what is it, who is it from/to, key amounts/dates
- Don't repeat the display_name
- Example: "Monthly consulting invoice for development services, due April 15, 2026."

## Important

- Only extract information explicitly present in the document
- If the document is unclear or mostly illegible, use generic metadata
- Always call save_metadata even for unclear documents (use "Untitled Document" if needed)
"""
```

---

### Task 5: Create Agent Module

**File:** `backend/app/agents/document_processor_agent/agent.py`

```python
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
    ResultMessage,
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
```

---

### Task 6: Create API Endpoint

**File to modify:** `backend/app/routes/document.py`

Add new endpoint for metadata generation. This follows the same SSE streaming pattern as `/api/agent/extract`.

**Add import at top:**
```python
from ..agents.document_processor_agent import process_document_metadata
```

**Add new endpoint:**
```python
@router.post("/metadata")
async def generate_metadata(
    document_id: str = Form(...),
    user_id: str = Depends(get_current_user),
):
    """
    Generate metadata for a document using AI.

    Requires document to have completed OCR processing.
    Writes display_name, tags, summary to documents table.

    Args:
        document_id: Document UUID (must have OCR cached)
        user_id: From Clerk JWT (injected via auth dependency)

    Returns:
        SSE stream with events:
        - {"text": "..."} - Claude's response
        - {"tool": "...", "input": {...}} - Tool activity
        - {"complete": true}
        - {"error": "..."}
    """
    supabase = get_supabase_client()

    # Verify document exists and belongs to user
    doc = supabase.table("documents") \
        .select("id, status") \
        .eq("id", document_id) \
        .eq("user_id", user_id) \
        .single() \
        .execute()

    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    # Verify OCR is complete
    if doc.data.get("status") not in ["ocr_complete", "completed"]:
        raise HTTPException(
            status_code=400,
            detail=f"Document not ready. Status: {doc.data.get('status')}"
        )

    # Verify OCR results exist
    ocr = supabase.table("ocr_results") \
        .select("id") \
        .eq("document_id", document_id) \
        .single() \
        .execute()

    if not ocr.data:
        raise HTTPException(status_code=400, detail="No OCR data found")

    async def event_stream() -> AsyncIterator[str]:
        """Generate SSE events from metadata processing."""
        try:
            async for event in process_document_metadata(
                document_id=document_id,
                user_id=user_id,
                db=supabase,
            ):
                yield sse_event(event)

        except Exception as e:
            logger.error(f"Metadata stream error: {e}")
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
```

**Note:** Create shared `sse_event` utility (DRY - already exists in `agent.py`):

**Step 6a: Create utils directory and init file**

```bash
mkdir -p backend/app/utils
```

**File:** `backend/app/utils/__init__.py`

```python
"""Shared utilities for the backend."""
```

**Step 6b: Create shared SSE utility**

**File:** `backend/app/utils/sse.py`

```python
"""Shared SSE utilities."""

import json
from typing import Any


def sse_event(data: dict[str, Any]) -> str:
    """Format data as SSE event."""
    return f"data: {json.dumps(data)}\n\n"
```

**Step 6c: Import in document.py**

```python
from ..utils.sse import sse_event
```

**Step 6c: Update agent.py to use shared utility (cleanup)**

Replace local `sse_event` in `backend/app/routes/agent.py` with:
```python
from ..utils.sse import sse_event
```

---

### Task 7: Add Required Imports to document.py

Ensure these imports exist at the top of `backend/app/routes/document.py`:

```python
import json
import logging
from typing import AsyncIterator

from fastapi import HTTPException
from fastapi.responses import StreamingResponse

from ..agents.document_processor_agent import process_document_metadata
from ..utils.sse import sse_event

logger = logging.getLogger(__name__)
```

**Note:** `HTTPException` is used for 404/400 errors, `logging` for error tracking.

---

### Task 8: Create Agent CLAUDE.md

**File:** `backend/app/agents/document_processor_agent/CLAUDE.md`

```markdown
# Document Processor Agent

**Purpose:** Generate document metadata (display_name, tags, summary) from OCR text using Claude Agent SDK.

## Files

| File | Description |
|------|-------------|
| `agent.py` | Main agent logic: `process_document_metadata()` |
| `prompts.py` | System prompt for metadata generation |
| `__init__.py` | Public exports for the agent module |

### tools/

| File | Description |
|------|-------------|
| `__init__.py` | Tool factory: `create_tools()` scopes tools to document context |
| `read_ocr.py` | Read OCR text from `ocr_results` table |
| `save_metadata.py` | Write metadata to `documents` table |

## Data Flow

1. Route validates document has OCR, calls `process_document_metadata()`
2. Agent uses `read_ocr` to get document text
3. Agent analyzes content and generates metadata
4. Agent calls `save_metadata` to write to database
5. Events stream via SSE: `{"text": "..."}`, `{"tool": "..."}`, `{"complete": true}`

## Key Patterns

- **Tool Factory Pattern**: `create_tools(document_id, user_id, db)` scopes all database access
- **MCP Server**: Tools registered as `mcp__metadata__*`
- **Lightweight**: Only 2 tools, 3 max turns - fast execution

## Triggered By

`POST /api/document/metadata` (see `routes/document.py`)

## Output Schema

The agent writes to `documents` table:
- `display_name` (TEXT): Descriptive filename
- `tags` (TEXT[]): 3-10 searchable tags
- `summary` (TEXT): 1-2 sentence description
```

---

### Task 9: Update Routes CLAUDE.md

**File to modify:** `backend/app/routes/CLAUDE.md`

Add the new endpoint to the endpoints table:

```markdown
| `/api/document/metadata` | POST | JWT | Generate AI metadata (SSE stream) |
```

---

## Error Handling

Per the design doc:

| Scenario | Behavior |
|----------|----------|
| OCR not ready | Return 400 with "Document not ready" message |
| Metadata generation fails | Stream `{"error": "..."}`, document keeps NULL metadata |
| Agent timeout | Same as failure - NULL metadata, frontend can retry |

The agent does NOT mark the document as failed - it simply doesn't write metadata. Users can retry via the "Regenerate" button which calls the same endpoint.

---

## Testing Approach

### Manual Testing

1. **Happy path:**
   - Upload a document via `/api/document/upload`
   - Wait for OCR to complete (status = `ocr_complete`)
   - Call `POST /api/document/metadata` with the document_id
   - Verify SSE events stream correctly
   - Verify `documents` table has `display_name`, `tags`, `summary` populated

2. **Error cases:**
   - Call with invalid document_id (expect 404)
   - Call with document still processing (expect 400)
   - Call with document that has no OCR (expect 400)

### Test Script

Create `backend/tests/test_metadata_agent.py`:

```python
"""
Tests for document processor agent.

Run: pytest backend/tests/test_metadata_agent.py -v
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestSaveMetadataTool:
    """Test save_metadata tool validation."""

    def test_rejects_empty_display_name(self):
        """Should reject empty display_name."""
        # Setup mock db
        db = MagicMock()

        from app.agents.document_processor_agent.tools.save_metadata import (
            create_save_metadata_tool
        )

        tool = create_save_metadata_tool("doc-123", "user-456", db)

        # Test would need async handling
        # This is a structure example - actual test needs pytest-asyncio

    def test_truncates_long_summary(self):
        """Should truncate summary over 200 chars."""
        pass  # Implement with async test

    def test_cleans_tags(self):
        """Should lowercase and dedupe tags."""
        pass  # Implement with async test


class TestProcessDocumentMetadata:
    """Test the main agent function."""

    @pytest.mark.asyncio
    async def test_yields_complete_event(self):
        """Should yield complete event on success."""
        pass  # Implement with mocked ClaudeSDKClient
```

---

## Verification Checklist

Before marking complete:

- [ ] All files created in `backend/app/agents/document_processor_agent/`
- [ ] `read_ocr` tool reads from correct table with user_id filter
- [ ] `save_metadata` tool validates input and writes to `documents` table
- [ ] System prompt guides agent to generate appropriate metadata
- [ ] API endpoint validates document status before calling agent
- [ ] SSE streaming works correctly (test with curl or frontend)
- [ ] Error handling returns appropriate status codes
- [ ] CLAUDE.md files updated

---

## Example API Usage

```bash
# Generate metadata for a document
curl -X POST https://api.stackdocs.io/api/document/metadata \
  -H "Authorization: Bearer <clerk_token>" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "document_id=<uuid>"

# Response (SSE stream):
# data: {"tool": "read_ocr", "input": {}}
# data: {"text": "I can see this is an invoice from Acme Corp..."}
# data: {"tool": "save_metadata", "input": {"display_name": "Invoice - Acme Corp - March 2026.pdf", "tags": ["invoice", "acme-corp"], "summary": "Monthly invoice for consulting services."}}
# data: {"text": "I've saved the metadata for this document."}
# data: {"complete": true}
```

---

## Dependencies

No new dependencies required. Uses existing:
- `claude_agent_sdk`
- `supabase`
- `fastapi`
