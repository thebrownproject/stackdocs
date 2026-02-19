# Stack Agent Tools Implementation Plan [ARCHIVED]

> **MIGRATED TO BEADS:** All tasks have been migrated to Beads issue tracker as epic `stackdocs-drg`.
> Use `bd show stackdocs-drg` to view the epic and its child tasks.
> This file is kept for historical reference and detailed implementation notes.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the stack extraction agent with scoped MCP tools.

**Architecture:** Agent reads document extractions, infers/uses columns, writes rows to stack_table_rows. All tools scoped to user_id/stack_id.

**Tech Stack:** Claude Agent SDK, Supabase Python client

---

## Task 1: Create Stack Agent Directory Structure

**Files:**
- Create: `backend/app/agents/stack_agent/__init__.py`
- Create: `backend/app/agents/stack_agent/agent.py`
- Create: `backend/app/agents/stack_agent/prompts.py`
- Create: `backend/app/agents/stack_agent/tools/__init__.py`

**Step 1: Create directory and init files**

```python
# backend/app/agents/stack_agent/__init__.py
from .agent import extract_stack_table, correct_stack_table

__all__ = ["extract_stack_table", "correct_stack_table"]
```

**Step 2: Commit**

```bash
mkdir -p backend/app/agents/stack_agent/tools
touch backend/app/agents/stack_agent/__init__.py
touch backend/app/agents/stack_agent/agent.py
touch backend/app/agents/stack_agent/prompts.py
touch backend/app/agents/stack_agent/tools/__init__.py
git add backend/app/agents/stack_agent/
git commit -m "feat(backend): create stack agent directory structure"
```

---

## Task 2: Create Stack Agent Prompts

**Files:**
- Modify: `backend/app/agents/stack_agent/prompts.py`

**Step 1: Write system prompt and templates**

```python
# backend/app/agents/stack_agent/prompts.py

STACK_EXTRACTION_SYSTEM_PROMPT = """You are an expert data extraction agent for Stackdocs.

Your task is to extract structured data from multiple documents into a table format.

## Context
- You're working on a stack (collection of related documents)
- The user has described the stack's purpose
- You need to extract consistent data across all documents

## Available Tools
- `read_document_extraction` - Read existing extraction for a document
- `read_ocr` - Read raw OCR text for a document (if extraction insufficient)
- `define_columns` - Define the table columns (auto mode only)
- `save_row` - Save extracted data for a document
- `update_row` - Update specific fields in an existing row
- `complete` - Mark extraction as complete

## Workflow
1. If auto mode: Analyze first few documents to infer appropriate columns
2. Use define_columns to set the schema (or use provided custom_columns)
3. For each document: read extraction, extract relevant fields, save_row
4. Call complete when done

## Rules
- Be consistent with data formats (dates, currencies, etc.)
- Use null for missing fields, don't guess
- Include confidence scores for each field
- Process all documents before completing
"""

STACK_EXTRACTION_TASK_TEMPLATE = """## Stack Information
Name: {stack_name}
Description: {stack_description}

## Table Configuration
Table Name: {table_name}
Mode: {mode}
{columns_section}

## Documents to Process
{document_list}

## Instructions
Extract the relevant data from each document into table rows.
{mode_instructions}
"""

AUTO_MODE_INSTRUCTIONS = """Since this is AUTO mode:
1. First analyze 2-3 documents to understand their structure
2. Use define_columns to set appropriate columns based on what you find
3. Then extract data from ALL documents using that schema
"""

CUSTOM_MODE_INSTRUCTIONS = """Since this is CUSTOM mode:
The user has specified these columns: {custom_columns}
Extract ONLY these fields from each document.
"""

CORRECTION_PROMPT_TEMPLATE = """The user has requested a correction to the extracted data:

{instruction}

## Instructions
1. Use read_rows to see current table data
2. Use update_row to make the requested changes
3. Be precise - only change what the user asked for
4. Summarize what you changed
"""
```

**Step 2: Commit**

```bash
git add backend/app/agents/stack_agent/prompts.py
git commit -m "feat(backend): add stack agent prompts"
```

---

## Task 3: Create Read Tools

**Files:**
- Create: `backend/app/agents/stack_agent/tools/read_tools.py`

**Step 1: Implement read tools**

```python
# backend/app/agents/stack_agent/tools/read_tools.py

from supabase import Client
from claude_sdk import tool


def create_read_document_extraction_tool(user_id: str, db: Client):
    @tool(
        "read_document_extraction",
        "Read the existing extraction for a document",
        {"document_id": str}
    )
    async def read_document_extraction(args: dict) -> dict:
        document_id = args.get("document_id")
        if not document_id:
            return {"content": [{"type": "text", "text": "document_id is required"}], "is_error": True}

        # Get latest extraction for this document
        result = db.table("extractions") \
            .select("extracted_fields, confidence_scores") \
            .eq("document_id", document_id) \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()

        if not result.data:
            return {"content": [{"type": "text", "text": f"No extraction found for document {document_id}"}]}

        import json
        extraction = result.data[0]
        return {
            "content": [{
                "type": "text",
                "text": json.dumps({
                    "extracted_fields": extraction["extracted_fields"],
                    "confidence_scores": extraction.get("confidence_scores", {})
                }, indent=2)
            }]
        }

    return read_document_extraction


def create_read_ocr_tool(user_id: str, db: Client):
    @tool(
        "read_ocr",
        "Read the raw OCR text for a document",
        {"document_id": str}
    )
    async def read_ocr(args: dict) -> dict:
        document_id = args.get("document_id")
        if not document_id:
            return {"content": [{"type": "text", "text": "document_id is required"}], "is_error": True}

        result = db.table("ocr_results") \
            .select("raw_text") \
            .eq("document_id", document_id) \
            .eq("user_id", user_id) \
            .single() \
            .execute()

        if not result.data:
            return {"content": [{"type": "text", "text": f"No OCR data found for document {document_id}"}]}

        return {"content": [{"type": "text", "text": result.data["raw_text"]}]}

    return read_ocr


def create_read_rows_tool(table_id: str, user_id: str, db: Client):
    @tool(
        "read_rows",
        "Read all current rows in the table",
        {}
    )
    async def read_rows(args: dict) -> dict:
        result = db.table("stack_table_rows") \
            .select("document_id, row_data, confidence_scores") \
            .eq("table_id", table_id) \
            .eq("user_id", user_id) \
            .execute()

        if not result.data:
            return {"content": [{"type": "text", "text": "No rows in table yet"}]}

        import json
        return {"content": [{"type": "text", "text": json.dumps(result.data, indent=2)}]}

    return read_rows
```

**Step 2: Commit**

```bash
git add backend/app/agents/stack_agent/tools/read_tools.py
git commit -m "feat(backend): add stack agent read tools"
```

---

## Task 4: Create Write Tools

**Files:**
- Create: `backend/app/agents/stack_agent/tools/write_tools.py`

**Step 1: Implement write tools**

```python
# backend/app/agents/stack_agent/tools/write_tools.py

from supabase import Client
from claude_sdk import tool
from typing import Any
import json


def create_define_columns_tool(table_id: str, user_id: str, db: Client):
    @tool(
        "define_columns",
        "Define the columns for this table (auto mode only)",
        {
            "columns": list  # List of {"name": str, "description": str, "type": str}
        }
    )
    async def define_columns(args: dict) -> dict:
        columns = args.get("columns", [])
        if not columns:
            return {"content": [{"type": "text", "text": "columns list is required"}], "is_error": True}

        # Validate column format
        for col in columns:
            if not isinstance(col, dict) or "name" not in col:
                return {"content": [{"type": "text", "text": "Each column must have a 'name' field"}], "is_error": True}

        # Update table with columns
        db.table("stack_tables").update({
            "columns": columns
        }).eq("id", table_id).eq("user_id", user_id).execute()

        column_names = [c["name"] for c in columns]
        return {"content": [{"type": "text", "text": f"Defined columns: {', '.join(column_names)}"}]}

    return define_columns


def create_save_row_tool(table_id: str, user_id: str, db: Client):
    @tool(
        "save_row",
        "Save extracted data for a document as a table row",
        {
            "document_id": str,
            "row_data": dict,  # Column name -> value
            "confidence_scores": dict  # Column name -> confidence (0-1)
        }
    )
    async def save_row(args: dict) -> dict:
        document_id = args.get("document_id")
        row_data = args.get("row_data", {})
        confidence_scores = args.get("confidence_scores", {})

        if not document_id:
            return {"content": [{"type": "text", "text": "document_id is required"}], "is_error": True}

        # Check if row already exists
        existing = db.table("stack_table_rows") \
            .select("id") \
            .eq("table_id", table_id) \
            .eq("document_id", document_id) \
            .execute()

        if existing.data:
            # Update existing row
            db.table("stack_table_rows").update({
                "row_data": row_data,
                "confidence_scores": confidence_scores,
            }).eq("id", existing.data[0]["id"]).execute()
            return {"content": [{"type": "text", "text": f"Updated row for document {document_id}"}]}
        else:
            # Insert new row
            db.table("stack_table_rows").insert({
                "table_id": table_id,
                "document_id": document_id,
                "user_id": user_id,
                "row_data": row_data,
                "confidence_scores": confidence_scores,
            }).execute()
            return {"content": [{"type": "text", "text": f"Saved row for document {document_id}"}]}

    return save_row


def create_update_row_tool(table_id: str, user_id: str, db: Client):
    @tool(
        "update_row",
        "Update specific fields in an existing row",
        {
            "document_id": str,
            "field_updates": dict,  # Column name -> new value
            "confidence_updates": dict  # Optional: Column name -> new confidence
        }
    )
    async def update_row(args: dict) -> dict:
        document_id = args.get("document_id")
        field_updates = args.get("field_updates", {})
        confidence_updates = args.get("confidence_updates", {})

        if not document_id:
            return {"content": [{"type": "text", "text": "document_id is required"}], "is_error": True}

        # Get existing row
        existing = db.table("stack_table_rows") \
            .select("id, row_data, confidence_scores") \
            .eq("table_id", table_id) \
            .eq("document_id", document_id) \
            .single() \
            .execute()

        if not existing.data:
            return {"content": [{"type": "text", "text": f"No row found for document {document_id}"}], "is_error": True}

        # Merge updates
        current_data = existing.data["row_data"] or {}
        current_confidence = existing.data["confidence_scores"] or {}

        new_data = {**current_data, **field_updates}
        new_confidence = {**current_confidence, **confidence_updates}

        # Update
        db.table("stack_table_rows").update({
            "row_data": new_data,
            "confidence_scores": new_confidence,
        }).eq("id", existing.data["id"]).execute()

        updated_fields = list(field_updates.keys())
        return {"content": [{"type": "text", "text": f"Updated fields: {', '.join(updated_fields)}"}]}

    return update_row


def create_complete_tool(table_id: str, db: Client):
    @tool(
        "complete",
        "Mark extraction as complete",
        {"summary": str}
    )
    async def complete(args: dict) -> dict:
        summary = args.get("summary", "Extraction completed")

        db.table("stack_tables").update({
            "status": "completed"
        }).eq("id", table_id).execute()

        return {"content": [{"type": "text", "text": summary}]}

    return complete
```

**Step 2: Commit**

```bash
git add backend/app/agents/stack_agent/tools/write_tools.py
git commit -m "feat(backend): add stack agent write tools"
```

---

## Task 5: Create Tools Index

**Files:**
- Modify: `backend/app/agents/stack_agent/tools/__init__.py`

**Step 1: Create tool factory**

```python
# backend/app/agents/stack_agent/tools/__init__.py

from supabase import Client
from .read_tools import (
    create_read_document_extraction_tool,
    create_read_ocr_tool,
    create_read_rows_tool,
)
from .write_tools import (
    create_define_columns_tool,
    create_save_row_tool,
    create_update_row_tool,
    create_complete_tool,
)


def create_extraction_tools(
    table_id: str,
    user_id: str,
    db: Client,
    mode: str = "auto",
):
    """Create all tools for stack extraction, scoped to table/user."""
    tools = [
        create_read_document_extraction_tool(user_id, db),
        create_read_ocr_tool(user_id, db),
        create_save_row_tool(table_id, user_id, db),
        create_update_row_tool(table_id, user_id, db),
        create_complete_tool(table_id, db),
    ]

    # Only include define_columns for auto mode
    if mode == "auto":
        tools.append(create_define_columns_tool(table_id, user_id, db))

    return tools


def create_correction_tools(table_id: str, user_id: str, db: Client):
    """Create tools for correction workflow."""
    return [
        create_read_rows_tool(table_id, user_id, db),
        create_update_row_tool(table_id, user_id, db),
        create_complete_tool(table_id, db),
    ]
```

**Step 2: Commit**

```bash
git add backend/app/agents/stack_agent/tools/__init__.py
git commit -m "feat(backend): add stack agent tool factory"
```

---

## Task 6: Create Main Agent Functions

**Files:**
- Modify: `backend/app/agents/stack_agent/agent.py`

**Step 1: Implement extraction and correction functions**

```python
# backend/app/agents/stack_agent/agent.py

from typing import AsyncIterator, Any
from supabase import Client
from claude_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    create_sdk_mcp_server,
    ResultMessage,
    AssistantMessage,
    TextBlock,
    ToolUseBlock,
)
from .tools import create_extraction_tools, create_correction_tools
from .prompts import (
    STACK_EXTRACTION_SYSTEM_PROMPT,
    STACK_EXTRACTION_TASK_TEMPLATE,
    AUTO_MODE_INSTRUCTIONS,
    CUSTOM_MODE_INSTRUCTIONS,
    CORRECTION_PROMPT_TEMPLATE,
)


async def extract_stack_table(
    stack_id: str,
    table_id: str,
    document_ids: list[str],
    stack_description: str | None,
    table_config: dict,
    user_id: str,
    db: Client,
) -> AsyncIterator[dict[str, Any]]:
    """Extract data from documents to stack table. Yields SSE events."""

    mode = table_config.get("mode", "auto")
    table_name = table_config.get("name", "Data")
    custom_columns = table_config.get("custom_columns")

    # Get document filenames
    docs = db.table("documents").select("id, filename").in_("id", document_ids).execute()
    doc_map = {d["id"]: d["filename"] for d in (docs.data or [])}
    document_list = "\n".join([f"- {doc_map.get(did, did)} (ID: {did})" for did in document_ids])

    # Build columns section
    if mode == "custom" and custom_columns:
        columns_section = f"Custom Columns: {', '.join(custom_columns)}"
        mode_instructions = CUSTOM_MODE_INSTRUCTIONS.format(custom_columns=custom_columns)
    else:
        columns_section = "Columns: To be determined (analyze documents first)"
        mode_instructions = AUTO_MODE_INSTRUCTIONS

    # Build task prompt
    task_prompt = STACK_EXTRACTION_TASK_TEMPLATE.format(
        stack_name=table_config.get("name", "Stack"),
        stack_description=stack_description or "No description provided",
        table_name=table_name,
        mode=mode,
        columns_section=columns_section,
        document_list=document_list,
        mode_instructions=mode_instructions,
    )

    # Create tools
    tools = create_extraction_tools(table_id, user_id, db, mode)

    # Create MCP server
    stack_server = create_sdk_mcp_server(name="stack", tools=tools)

    tool_names = [
        "mcp__stack__read_document_extraction",
        "mcp__stack__read_ocr",
        "mcp__stack__save_row",
        "mcp__stack__update_row",
        "mcp__stack__complete",
    ]
    if mode == "auto":
        tool_names.append("mcp__stack__define_columns")

    options = ClaudeAgentOptions(
        system_prompt=STACK_EXTRACTION_SYSTEM_PROMPT,
        mcp_servers={"stack": stack_server},
        allowed_tools=tool_names,
        max_turns=len(document_ids) + 5,  # Allow enough turns for all docs
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
                        if isinstance(block, TextBlock):
                            yield {"text": block.text}
                        elif isinstance(block, ToolUseBlock):
                            yield {"tool": block.name, "input": block.input}

        # Save session ID for corrections
        if session_id:
            db.table("stack_tables").update({
                "session_id": session_id,
                "status": "completed"
            }).eq("id", table_id).execute()

        yield {"complete": True, "table_id": table_id, "session_id": session_id}

    except Exception as e:
        db.table("stack_tables").update({"status": "failed"}).eq("id", table_id).execute()
        yield {"error": str(e)}


async def correct_stack_table(
    session_id: str,
    table_id: str,
    instruction: str,
    user_id: str,
    db: Client,
) -> AsyncIterator[dict[str, Any]]:
    """Correct table data using natural language. Yields SSE events."""

    tools = create_correction_tools(table_id, user_id, db)
    stack_server = create_sdk_mcp_server(name="stack", tools=tools)

    options = ClaudeAgentOptions(
        resume=session_id,
        mcp_servers={"stack": stack_server},
        allowed_tools=[
            "mcp__stack__read_rows",
            "mcp__stack__update_row",
            "mcp__stack__complete",
        ],
        max_turns=5,
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

        yield {"complete": True, "table_id": table_id}

    except Exception as e:
        yield {"error": str(e)}
```

**Step 2: Commit**

```bash
git add backend/app/agents/stack_agent/agent.py
git commit -m "feat(backend): implement stack extraction agent"
```
