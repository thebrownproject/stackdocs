# Stacks Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to group documents into stacks and extract tabular data across all documents with a consistent schema.

**Architecture:** Reuse the Agent SDK infrastructure from document extraction. Stacks agent reads existing `extractions.extracted_fields` (no re-OCR), defines columns dynamically, and populates rows. Dynamic tool schemas enforce column consistency.

**Tech Stack:** FastAPI, Claude Agent SDK, Supabase (database ready - migrations 004 & 005 applied), Next.js (frontend)

**Prerequisites:** Agent SDK frontend integration (Phase 7) must be complete before starting frontend tasks.

---

## Phase 1: Stacks Agent & Tools

### Task 1: Create Stacks Agent Structure

**Files:**
- Create: `backend/app/agents/stacks_agent/__init__.py`
- Create: `backend/app/agents/stacks_agent/agent.py`
- Create: `backend/app/agents/stacks_agent/prompts.py`
- Create: `backend/app/agents/stacks_agent/tools/__init__.py`

**Step 1: Create agent directory structure**

```bash
mkdir -p backend/app/agents/stacks_agent/tools
```

**Step 2: Create `__init__.py` files**

```python
# backend/app/agents/stacks_agent/__init__.py
from .agent import extract_stack_table, correct_stack_table

__all__ = ["extract_stack_table", "correct_stack_table"]
```

```python
# backend/app/agents/stacks_agent/tools/__init__.py
from .define_columns import define_columns_tool
from .read_document_extraction import read_document_extraction_tool
from .save_table_row import create_save_row_tool
from .update_table_row import create_update_row_tool
from .bulk_update_rows import bulk_update_rows_tool

__all__ = [
    "define_columns_tool",
    "read_document_extraction_tool",
    "create_save_row_tool",
    "create_update_row_tool",
    "bulk_update_rows_tool",
]
```

**Step 3: Create prompts.py**

```python
# backend/app/agents/stacks_agent/prompts.py
"""System prompts for stacks agent."""

STACK_EXTRACTION_PROMPT = """You are an expert data extraction agent for Stackdocs.

You are working with a Stack containing multiple documents. Your job is to extract tabular data from all documents into a consistent table format.

## Available Tools

**Read:**
- `read_document_extraction` - Read an existing extraction for a document

**Write:**
- `define_columns` - (Auto mode only) Define the table columns after analyzing documents
- `save_table_row` - Save a row for a document with the defined columns
- `update_table_row` - Update specific cells in a row
- `bulk_update_rows` - Update all rows matching a condition

## Workflow for Initial Extraction

1. Read the existing extractions for each document using `read_document_extraction`
2. If auto mode: Call `define_columns` to propose column structure
3. For each document, call `save_table_row` with the extracted values
4. Summarize what you extracted

## Workflow for Corrections

1. Understand the user's correction request
2. Use `update_table_row` for single-row changes
3. Use `bulk_update_rows` for changes affecting multiple rows
4. Summarize what you changed

## Guidelines

- Extract values that match the defined columns exactly
- Use null for missing values
- Assign confidence scores (0.0-1.0) based on extraction certainty
- Column names must match exactly - no variations
"""

STACK_CORRECTION_PROMPT = """You are continuing a previous session to correct table data.

The user wants to make corrections. You have full context of:
- The stack and its documents
- The table columns
- All previously extracted rows

Apply the correction using the appropriate tool:
- `update_table_row` for single document changes
- `bulk_update_rows` for changes affecting multiple rows

After making changes, summarize what was updated.
"""
```

**Step 4: Commit**

```bash
git add backend/app/agents/stacks_agent/
git commit -m "feat(stacks): create stacks agent structure and prompts"
```

---

### Task 2: Implement `define_columns` Tool

**Files:**
- Create: `backend/app/agents/stacks_agent/tools/define_columns.py`

**Step 1: Create the tool**

```python
# backend/app/agents/stacks_agent/tools/define_columns.py
"""Tool for agent to define table columns (auto mode)."""

import json
import logging
from typing import Any

from claude_code_sdk import tool

logger = logging.getLogger(__name__)


def create_define_columns_tool(table_id: str, user_id: str, db):
    """Create a scoped define_columns tool for a specific table."""

    @tool(
        "define_columns",
        "Define the columns for this table based on document analysis",
        {
            "columns": list,  # [{"name": "vendor", "type": "text"}, ...]
            "reasoning": str,
        }
    )
    async def define_columns_tool(args: dict) -> dict:
        columns = args.get("columns", [])
        reasoning = args.get("reasoning", "")

        # Validate column structure
        if not columns:
            return {
                "content": [{"type": "text", "text": "Error: No columns provided"}],
                "is_error": True,
            }

        for col in columns:
            if "name" not in col:
                return {
                    "content": [{"type": "text", "text": f"Error: Column missing 'name': {col}"}],
                    "is_error": True,
                }

        # Save columns to stack_tables
        db.table("stack_tables").update({
            "columns": columns,
        }).eq("id", table_id).eq("user_id", user_id).execute()

        column_names = [col["name"] for col in columns]
        logger.info(f"Defined columns for table {table_id}: {column_names}")

        return {
            "content": [{
                "type": "text",
                "text": f"Defined {len(columns)} columns: {column_names}. Now extract rows for each document."
            }]
        }

    return define_columns_tool
```

**Step 2: Commit**

```bash
git add backend/app/agents/stacks_agent/tools/define_columns.py
git commit -m "feat(stacks): add define_columns tool"
```

---

### Task 3: Implement `read_document_extraction` Tool

**Files:**
- Create: `backend/app/agents/stacks_agent/tools/read_document_extraction.py`

**Step 1: Create the tool**

```python
# backend/app/agents/stacks_agent/tools/read_document_extraction.py
"""Tool for agent to read existing document extractions."""

import json
import logging
from claude_code_sdk import tool

logger = logging.getLogger(__name__)


def create_read_extraction_tool(stack_id: str, user_id: str, db):
    """Create a scoped read_document_extraction tool."""

    @tool(
        "read_document_extraction",
        "Read the existing extraction for a document in this stack",
        {"document_id": str}
    )
    async def read_document_extraction_tool(args: dict) -> dict:
        document_id = args.get("document_id")

        if not document_id:
            return {
                "content": [{"type": "text", "text": "Error: document_id required"}],
                "is_error": True,
            }

        # Verify document is in this stack
        stack_doc = db.table("stack_documents").select("*").eq(
            "stack_id", stack_id
        ).eq("document_id", document_id).single().execute()

        if not stack_doc.data:
            return {
                "content": [{"type": "text", "text": f"Error: Document {document_id} not in this stack"}],
                "is_error": True,
            }

        # Get latest extraction
        extraction = db.table("extractions").select(
            "extracted_fields, confidence_scores"
        ).eq("document_id", document_id).eq("user_id", user_id).order(
            "created_at", desc=True
        ).limit(1).single().execute()

        if not extraction.data:
            return {
                "content": [{"type": "text", "text": f"No extraction found for document {document_id}"}],
                "is_error": True,
            }

        # Get document filename for context
        doc = db.table("documents").select("filename").eq("id", document_id).single().execute()
        filename = doc.data.get("filename", "unknown") if doc.data else "unknown"

        return {
            "content": [{
                "type": "text",
                "text": f"Document: {filename}\n\n{json.dumps(extraction.data['extracted_fields'], indent=2)}"
            }]
        }

    return read_document_extraction_tool
```

**Step 2: Commit**

```bash
git add backend/app/agents/stacks_agent/tools/read_document_extraction.py
git commit -m "feat(stacks): add read_document_extraction tool"
```

---

### Task 4: Implement `save_table_row` Tool (Dynamic Schema)

**Files:**
- Create: `backend/app/agents/stacks_agent/tools/save_table_row.py`

**Step 1: Create the dynamic tool factory**

```python
# backend/app/agents/stacks_agent/tools/save_table_row.py
"""Dynamic tool for saving table rows with enforced column schema."""

import json
import logging
from typing import Any
from claude_code_sdk import tool

logger = logging.getLogger(__name__)


def create_save_row_tool(table_id: str, user_id: str, columns: list[dict], db):
    """
    Create a save_table_row tool with schema matching the table columns.

    Args:
        table_id: The stack table ID
        user_id: The user ID
        columns: List of column definitions from stack_tables.columns
        db: Supabase client
    """
    # Build parameter schema from columns
    param_schema = {
        "document_id": str,  # Always required
    }

    column_names = []
    for col in columns:
        col_name = col.get("name")
        if col_name:
            param_schema[col_name] = str
            column_names.append(col_name)

    param_schema["confidence_scores"] = dict

    @tool(
        "save_table_row",
        f"Save a row to the table. Required columns: {column_names}",
        param_schema
    )
    async def save_table_row(args: dict) -> dict:
        document_id = args.pop("document_id", None)
        confidence_scores = args.pop("confidence_scores", {})

        if not document_id:
            return {
                "content": [{"type": "text", "text": "Error: document_id required"}],
                "is_error": True,
            }

        # Remaining args are the row data
        row_data = {}
        for col_name in column_names:
            row_data[col_name] = args.get(col_name)

        # Check if row already exists (upsert)
        existing = db.table("stack_table_rows").select("id").eq(
            "table_id", table_id
        ).eq("document_id", document_id).single().execute()

        if existing.data:
            # Update existing row
            db.table("stack_table_rows").update({
                "row_data": row_data,
                "confidence_scores": confidence_scores,
            }).eq("id", existing.data["id"]).execute()
            action = "Updated"
        else:
            # Insert new row
            db.table("stack_table_rows").insert({
                "table_id": table_id,
                "document_id": document_id,
                "row_data": row_data,
                "confidence_scores": confidence_scores,
            }).execute()
            action = "Saved"

        logger.info(f"{action} row for document {document_id} in table {table_id}")

        return {
            "content": [{
                "type": "text",
                "text": f"{action} row for document {document_id}"
            }]
        }

    return save_table_row
```

**Step 2: Commit**

```bash
git add backend/app/agents/stacks_agent/tools/save_table_row.py
git commit -m "feat(stacks): add save_table_row tool with dynamic schema"
```

---

### Task 5: Implement `update_table_row` and `bulk_update_rows` Tools

**Files:**
- Create: `backend/app/agents/stacks_agent/tools/update_table_row.py`
- Create: `backend/app/agents/stacks_agent/tools/bulk_update_rows.py`

**Step 1: Create update_table_row tool**

```python
# backend/app/agents/stacks_agent/tools/update_table_row.py
"""Tool for updating specific cells in a table row."""

import logging
from claude_code_sdk import tool

logger = logging.getLogger(__name__)


def create_update_row_tool(table_id: str, user_id: str, columns: list[dict], db):
    """Create an update_table_row tool with column validation."""

    valid_columns = {col.get("name") for col in columns if col.get("name")}

    @tool(
        "update_table_row",
        f"Update specific fields in a row. Valid columns: {list(valid_columns)}",
        {
            "document_id": str,
            "updates": dict,  # {"column_name": "new_value", ...}
        }
    )
    async def update_table_row(args: dict) -> dict:
        document_id = args.get("document_id")
        updates = args.get("updates", {})

        if not document_id:
            return {
                "content": [{"type": "text", "text": "Error: document_id required"}],
                "is_error": True,
            }

        # Validate column names
        invalid_cols = set(updates.keys()) - valid_columns
        if invalid_cols:
            return {
                "content": [{
                    "type": "text",
                    "text": f"Error: Invalid columns: {invalid_cols}. Valid: {valid_columns}"
                }],
                "is_error": True,
            }

        # Get existing row
        row = db.table("stack_table_rows").select("id, row_data").eq(
            "table_id", table_id
        ).eq("document_id", document_id).single().execute()

        if not row.data:
            return {
                "content": [{"type": "text", "text": f"Error: No row found for document {document_id}"}],
                "is_error": True,
            }

        # Merge updates
        new_row_data = {**row.data["row_data"], **updates}

        db.table("stack_table_rows").update({
            "row_data": new_row_data,
        }).eq("id", row.data["id"]).execute()

        logger.info(f"Updated row for document {document_id}: {list(updates.keys())}")

        return {
            "content": [{
                "type": "text",
                "text": f"Updated {list(updates.keys())} for document {document_id}"
            }]
        }

    return update_table_row
```

**Step 2: Create bulk_update_rows tool**

```python
# backend/app/agents/stacks_agent/tools/bulk_update_rows.py
"""Tool for bulk updating rows matching a condition."""

import logging
from claude_code_sdk import tool

logger = logging.getLogger(__name__)


def create_bulk_update_tool(table_id: str, user_id: str, columns: list[dict], db):
    """Create a bulk_update_rows tool."""

    valid_columns = {col.get("name") for col in columns if col.get("name")}

    @tool(
        "bulk_update_rows",
        "Update all rows where a column matches a value",
        {
            "column": str,
            "match_value": str,
            "new_value": str,
        }
    )
    async def bulk_update_rows(args: dict) -> dict:
        column = args.get("column")
        match_value = args.get("match_value")
        new_value = args.get("new_value")

        if column not in valid_columns:
            return {
                "content": [{
                    "type": "text",
                    "text": f"Error: Invalid column '{column}'. Valid: {valid_columns}"
                }],
                "is_error": True,
            }

        # Get all rows for this table
        rows = db.table("stack_table_rows").select("id, row_data").eq(
            "table_id", table_id
        ).execute()

        updated_count = 0
        for row in rows.data or []:
            if row["row_data"].get(column) == match_value:
                new_row_data = {**row["row_data"], column: new_value}
                db.table("stack_table_rows").update({
                    "row_data": new_row_data,
                }).eq("id", row["id"]).execute()
                updated_count += 1

        logger.info(f"Bulk updated {updated_count} rows: {column} '{match_value}' -> '{new_value}'")

        return {
            "content": [{
                "type": "text",
                "text": f"Updated {updated_count} rows: {column} '{match_value}' → '{new_value}'"
            }]
        }

    return bulk_update_rows
```

**Step 3: Commit**

```bash
git add backend/app/agents/stacks_agent/tools/update_table_row.py
git add backend/app/agents/stacks_agent/tools/bulk_update_rows.py
git commit -m "feat(stacks): add update_table_row and bulk_update_rows tools"
```

---

### Task 6: Implement Main Agent Functions

**Files:**
- Modify: `backend/app/agents/stacks_agent/agent.py`

**Step 1: Implement the main agent logic**

```python
# backend/app/agents/stacks_agent/agent.py
"""Main stacks agent logic for table extraction and correction."""

import json
import logging
from typing import Any, AsyncIterator

from claude_code_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    create_sdk_mcp_server,
    AssistantMessage,
    TextBlock,
    ToolUseBlock,
    ResultMessage,
)

from .prompts import STACK_EXTRACTION_PROMPT, STACK_CORRECTION_PROMPT
from .tools import (
    create_define_columns_tool,
    create_read_extraction_tool,
    create_save_row_tool,
    create_update_row_tool,
    create_bulk_update_tool,
)

logger = logging.getLogger(__name__)


async def extract_stack_table(
    table_id: str,
    stack_id: str,
    user_id: str,
    mode: str,
    custom_columns: list[str] | None,
    document_ids: list[str],
    db,
) -> AsyncIterator[dict[str, Any]]:
    """
    Extract table data from all documents in a stack.

    Yields SSE events:
        {"type": "status", "message": "..."}
        {"type": "thinking", "text": "..."}
        {"type": "columns_defined", "columns": [...]}
        {"type": "row_saved", "document_id": "...", "row": {...}}
        {"type": "complete", "session_id": "...", "row_count": N}
        {"type": "error", "message": "..."}
    """
    yield {"type": "status", "message": "Starting table extraction..."}

    # For custom mode, set columns upfront
    columns = []
    if mode == "custom" and custom_columns:
        columns = [{"name": col, "type": "text"} for col in custom_columns]
        db.table("stack_tables").update({"columns": columns}).eq("id", table_id).execute()
        yield {"type": "columns_defined", "columns": columns}

    # Create tools
    tools = [
        create_read_extraction_tool(stack_id, user_id, db),
    ]

    if mode == "auto":
        tools.append(create_define_columns_tool(table_id, user_id, db))

    # For save/update tools, we need columns - fetch after define_columns in auto mode
    # This is handled by creating tools dynamically after columns are defined

    # Build prompt
    doc_list = "\n".join([f"- {doc_id}" for doc_id in document_ids])
    prompt = f"""Extract tabular data from these documents into a table.

Mode: {mode}
{"Columns: " + ", ".join(custom_columns) if custom_columns else "Analyze documents and define appropriate columns."}

Documents in stack:
{doc_list}

Read each document's extraction, then save a row for each document.
"""

    # Create MCP server with tools
    mcp_server = create_sdk_mcp_server(name="stacks", tools=tools)

    tool_names = [f"mcp__stacks__{t.__name__}" for t in tools]

    options = ClaudeAgentOptions(
        mcp_servers={"stacks": mcp_server},
        allowed_tools=tool_names,
        max_turns=len(document_ids) * 2 + 5,  # Read + save for each doc, plus column definition
        system_prompt=STACK_EXTRACTION_PROMPT,
    )

    session_id = None
    row_count = 0

    try:
        async with ClaudeSDKClient(options=options) as client:
            await client.query(prompt)

            async for message in client.receive_response():
                if isinstance(message, ResultMessage):
                    session_id = message.session_id

                elif isinstance(message, AssistantMessage):
                    for block in message.content:
                        if isinstance(block, TextBlock):
                            yield {"type": "thinking", "text": block.text}

                        elif isinstance(block, ToolUseBlock):
                            if "define_columns" in block.name:
                                # Refresh columns and add row tools
                                table = db.table("stack_tables").select("columns").eq(
                                    "id", table_id
                                ).single().execute()
                                if table.data and table.data.get("columns"):
                                    columns = table.data["columns"]
                                    yield {"type": "columns_defined", "columns": columns}

                            elif "save_table_row" in block.name:
                                row_count += 1
                                yield {
                                    "type": "row_saved",
                                    "document_id": block.input.get("document_id"),
                                    "row": block.input,
                                }

        # Update table with session_id
        db.table("stack_tables").update({
            "session_id": session_id,
            "status": "completed",
        }).eq("id", table_id).execute()

        yield {
            "type": "complete",
            "session_id": session_id,
            "row_count": row_count,
        }

    except Exception as e:
        logger.error(f"Stack extraction failed: {e}")
        db.table("stack_tables").update({"status": "failed"}).eq("id", table_id).execute()
        yield {"type": "error", "message": str(e)}


async def correct_stack_table(
    table_id: str,
    session_id: str,
    instruction: str,
    columns: list[dict],
    db,
) -> AsyncIterator[dict[str, Any]]:
    """
    Correct table data using session resume.

    Yields SSE events similar to extract_stack_table.
    """
    yield {"type": "status", "message": "Resuming session for correction..."}

    # Create correction tools with current columns
    tools = [
        create_update_row_tool(table_id, "", columns, db),
        create_bulk_update_tool(table_id, "", columns, db),
    ]

    mcp_server = create_sdk_mcp_server(name="stacks", tools=tools)
    tool_names = [f"mcp__stacks__{t.__name__}" for t in tools]

    options = ClaudeAgentOptions(
        resume=session_id,
        mcp_servers={"stacks": mcp_server},
        allowed_tools=tool_names,
        max_turns=5,
        system_prompt=STACK_CORRECTION_PROMPT,
    )

    updated_count = 0

    try:
        async with ClaudeSDKClient(options=options) as client:
            await client.query(instruction)

            async for message in client.receive_response():
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if isinstance(block, TextBlock):
                            yield {"type": "thinking", "text": block.text}

                        elif isinstance(block, ToolUseBlock):
                            if "update" in block.name:
                                updated_count += 1
                                yield {
                                    "type": "row_updated",
                                    "tool": block.name,
                                    "input": block.input,
                                }

        yield {"type": "complete", "updated_count": updated_count}

    except Exception as e:
        logger.error(f"Stack correction failed: {e}")
        yield {"type": "error", "message": str(e)}
```

**Step 2: Commit**

```bash
git add backend/app/agents/stacks_agent/agent.py
git commit -m "feat(stacks): implement main agent extraction and correction functions"
```

---

## Phase 2: Backend API Routes

### Task 7: Create Stacks Routes

**Files:**
- Create: `backend/app/routes/stacks.py`
- Modify: `backend/app/main.py`

**Step 1: Create the routes file**

```python
# backend/app/routes/stacks.py
"""Stacks API routes."""

import json
import logging
from typing import AsyncIterator

from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import StreamingResponse

from ..agents.stacks_agent import extract_stack_table, correct_stack_table
from ..database import get_supabase_client

router = APIRouter(prefix="/api/stacks", tags=["stacks"])
logger = logging.getLogger(__name__)


def sse_event(data: dict) -> str:
    """Format data as SSE event."""
    return f"data: {json.dumps(data)}\n\n"


@router.post("")
async def create_stack(
    name: str = Form(...),
    description: str = Form(""),
    user_id: str = Form(...),
):
    """Create a new stack."""
    db = get_supabase_client()

    result = db.table("stacks").insert({
        "user_id": user_id,
        "name": name,
        "description": description,
        "status": "active",
    }).execute()

    return {"stack": result.data[0]}


@router.post("/{stack_id}/documents")
async def add_documents_to_stack(
    stack_id: str,
    document_ids: str = Form(...),  # Comma-separated
    user_id: str = Form(...),
):
    """Add documents to a stack."""
    db = get_supabase_client()

    # Verify stack ownership
    stack = db.table("stacks").select("id").eq("id", stack_id).eq("user_id", user_id).single().execute()
    if not stack.data:
        raise HTTPException(status_code=404, detail="Stack not found")

    doc_ids = [d.strip() for d in document_ids.split(",") if d.strip()]

    # Insert stack_documents (ignore duplicates)
    for doc_id in doc_ids:
        try:
            db.table("stack_documents").insert({
                "stack_id": stack_id,
                "document_id": doc_id,
            }).execute()
        except Exception:
            pass  # Ignore duplicate key errors

    return {"added": len(doc_ids), "stack_id": stack_id}


@router.post("/{stack_id}/tables")
async def create_stack_table(
    stack_id: str,
    name: str = Form(...),
    mode: str = Form("auto"),
    custom_columns: str = Form(""),  # Comma-separated
    user_id: str = Form(...),
):
    """Create a new table in a stack."""
    db = get_supabase_client()

    # Verify stack ownership
    stack = db.table("stacks").select("id").eq("id", stack_id).eq("user_id", user_id).single().execute()
    if not stack.data:
        raise HTTPException(status_code=404, detail="Stack not found")

    columns_list = [c.strip() for c in custom_columns.split(",") if c.strip()] if custom_columns else None

    result = db.table("stack_tables").insert({
        "stack_id": stack_id,
        "user_id": user_id,
        "name": name,
        "mode": mode,
        "custom_columns": columns_list,
        "status": "pending",
    }).execute()

    return {"table": result.data[0]}


@router.post("/{stack_id}/tables/{table_id}/extract")
async def extract_table(
    stack_id: str,
    table_id: str,
    user_id: str = Form(...),
):
    """Extract data into a stack table (SSE streaming)."""
    db = get_supabase_client()

    # Get table info
    table = db.table("stack_tables").select("*").eq("id", table_id).eq("user_id", user_id).single().execute()
    if not table.data:
        raise HTTPException(status_code=404, detail="Table not found")

    # Get documents in stack
    stack_docs = db.table("stack_documents").select("document_id").eq("stack_id", stack_id).execute()
    document_ids = [d["document_id"] for d in stack_docs.data or []]

    if not document_ids:
        raise HTTPException(status_code=400, detail="No documents in stack")

    # Update status
    db.table("stack_tables").update({"status": "processing"}).eq("id", table_id).execute()

    async def event_stream() -> AsyncIterator[str]:
        async for event in extract_stack_table(
            table_id=table_id,
            stack_id=stack_id,
            user_id=user_id,
            mode=table.data["mode"],
            custom_columns=table.data.get("custom_columns"),
            document_ids=document_ids,
            db=db,
        ):
            yield sse_event(event)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.post("/{stack_id}/tables/{table_id}/correct")
async def correct_table(
    stack_id: str,
    table_id: str,
    instruction: str = Form(...),
    user_id: str = Form(...),
):
    """Correct table data using session resume (SSE streaming)."""
    db = get_supabase_client()

    # Get table with session_id
    table = db.table("stack_tables").select("*").eq("id", table_id).eq("user_id", user_id).single().execute()
    if not table.data:
        raise HTTPException(status_code=404, detail="Table not found")

    if not table.data.get("session_id"):
        raise HTTPException(status_code=400, detail="No session found. Extract first.")

    if not table.data.get("columns"):
        raise HTTPException(status_code=400, detail="No columns defined")

    async def event_stream() -> AsyncIterator[str]:
        async for event in correct_stack_table(
            table_id=table_id,
            session_id=table.data["session_id"],
            instruction=instruction,
            columns=table.data["columns"],
            db=db,
        ):
            yield sse_event(event)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/{stack_id}/tables/{table_id}/rows")
async def get_table_rows(
    stack_id: str,
    table_id: str,
    user_id: str,
):
    """Get all rows for a table."""
    db = get_supabase_client()

    # Verify ownership
    table = db.table("stack_tables").select("id").eq("id", table_id).eq("user_id", user_id).single().execute()
    if not table.data:
        raise HTTPException(status_code=404, detail="Table not found")

    rows = db.table("stack_table_rows").select(
        "*, documents(filename)"
    ).eq("table_id", table_id).execute()

    return {"rows": rows.data}
```

**Step 2: Register routes in main.py**

Add to `backend/app/main.py`:

```python
from .routes import stacks

app.include_router(stacks.router)
```

**Step 3: Commit**

```bash
git add backend/app/routes/stacks.py backend/app/main.py
git commit -m "feat(stacks): add stacks API routes"
```

---

## Phase 3: Frontend (After Agent SDK Phase 7)

> **Prerequisite:** Complete Agent SDK frontend integration (Phase 7) first. The hooks and SSE handling patterns from that phase will be reused here.

### Task 8: Create Stacks Hooks

**Files:**
- Create: `frontend/hooks/useStacks.ts`
- Create: `frontend/hooks/useStackTable.ts`

**Step 1: Create useStacks hook**

```typescript
// frontend/hooks/useStacks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useStacks(userId: string) {
  return useQuery({
    queryKey: ['stacks', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stacks')
        .select(`
          *,
          stack_documents(count)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
  })
}

export function useCreateStack() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, description, userId }: {
      name: string
      description: string
      userId: string
    }) => {
      const formData = new FormData()
      formData.append('name', name)
      formData.append('description', description)
      formData.append('user_id', userId)

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stacks`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Failed to create stack')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacks'] })
    },
  })
}
```

**Step 2: Create useStackTable hook (reuses SSE pattern from useAgentExtraction)**

```typescript
// frontend/hooks/useStackTable.ts
import { useState, useCallback } from 'react'

interface StackTableEvent {
  type: 'status' | 'thinking' | 'columns_defined' | 'row_saved' | 'complete' | 'error'
  message?: string
  text?: string
  columns?: { name: string; type: string }[]
  document_id?: string
  row?: Record<string, unknown>
  session_id?: string
  row_count?: number
}

export function useStackTableExtraction() {
  const [thinking, setThinking] = useState('')
  const [columns, setColumns] = useState<{ name: string; type: string }[]>([])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [isExtracting, setIsExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const extractTable = useCallback(async (
    stackId: string,
    tableId: string,
    userId: string
  ) => {
    setIsExtracting(true)
    setThinking('')
    setColumns([])
    setRows([])
    setError(null)

    const formData = new FormData()
    formData.append('user_id', userId)

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/stacks/${stackId}/tables/${tableId}/extract`,
        { method: 'POST', body: formData }
      )

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          const event: StackTableEvent = JSON.parse(line.slice(6))

          switch (event.type) {
            case 'thinking':
              setThinking(prev => prev + (event.text || ''))
              break
            case 'columns_defined':
              setColumns(event.columns || [])
              break
            case 'row_saved':
              setRows(prev => [...prev, event.row || {}])
              break
            case 'complete':
              setIsExtracting(false)
              break
            case 'error':
              setError(event.message || 'Extraction failed')
              setIsExtracting(false)
              break
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed')
      setIsExtracting(false)
    }
  }, [])

  return {
    thinking,
    columns,
    rows,
    isExtracting,
    error,
    extractTable,
  }
}
```

**Step 3: Commit**

```bash
git add frontend/hooks/useStacks.ts frontend/hooks/useStackTable.ts
git commit -m "feat(stacks): add stacks frontend hooks"
```

---

### Task 9: Create Stacks UI Components

**Files:**
- Create: `frontend/components/stacks/StackList.tsx`
- Create: `frontend/components/stacks/CreateStackModal.tsx`
- Create: `frontend/components/stacks/StackTableView.tsx`

**Step 1: Create StackList component**

(Component code - similar to DocumentGrid but for stacks)

**Step 2: Create CreateStackModal component**

(Modal for creating new stacks and adding documents)

**Step 3: Create StackTableView component**

(Table display with column headers from stack_tables.columns, rows from stack_table_rows)

**Step 4: Commit**

```bash
git add frontend/components/stacks/
git commit -m "feat(stacks): add stacks UI components"
```

---

### Task 10: Create Stacks Pages

**Files:**
- Create: `frontend/app/dashboard/stacks/page.tsx`
- Create: `frontend/app/dashboard/stacks/[stackId]/page.tsx`
- Create: `frontend/app/dashboard/stacks/[stackId]/tables/[tableId]/page.tsx`

**Step 1: Create stacks list page**

**Step 2: Create stack detail page (shows documents and tables)**

**Step 3: Create table view page (with extraction UI)**

**Step 4: Commit**

```bash
git add frontend/app/dashboard/stacks/
git commit -m "feat(stacks): add stacks pages"
```

---

## Phase 4: Testing & Verification

### Task 11: End-to-End Test

**Steps:**

1. Create a stack via API
2. Add 3+ documents with completed extractions
3. Create a table (auto mode)
4. Run extraction - verify rows created
5. Run correction - verify rows updated
6. Export to CSV - verify format

**Verification command:**

```bash
# Test stack creation
curl -X POST http://localhost:8000/api/stacks \
  -F "name=Test Stack" \
  -F "user_id=<user_id>"

# Add documents
curl -X POST http://localhost:8000/api/stacks/<stack_id>/documents \
  -F "document_ids=<doc1>,<doc2>,<doc3>" \
  -F "user_id=<user_id>"

# Create table
curl -X POST http://localhost:8000/api/stacks/<stack_id>/tables \
  -F "name=Test Table" \
  -F "mode=auto" \
  -F "user_id=<user_id>"

# Extract (SSE stream)
curl -X POST http://localhost:8000/api/stacks/<stack_id>/tables/<table_id>/extract \
  -F "user_id=<user_id>"
```

---

## Summary

| Phase | Tasks | Estimated Effort |
|-------|-------|------------------|
| Phase 1: Agent & Tools | Tasks 1-6 | Backend agent infrastructure |
| Phase 2: API Routes | Task 7 | FastAPI endpoints |
| Phase 3: Frontend | Tasks 8-10 | UI (after Agent SDK Phase 7) |
| Phase 4: Testing | Task 11 | End-to-end verification |

**Dependencies:**
- Phase 3 requires Agent SDK frontend (Phase 7) to be complete
- All phases require database migrations 004 & 005 (already applied)
