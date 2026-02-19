# Stack Agent Routes Implementation Plan [ARCHIVED]

> **MIGRATED TO BEADS:** All tasks have been migrated to Beads issue tracker as epic `stackdocs-drg`.
> Use `bd show stackdocs-drg` to view the epic and its child tasks.
> This file is kept for historical reference and detailed implementation notes.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create FastAPI routes for stack **agent operations only** (SSE streaming for extraction and correction).

**Architecture:** Stack CRUD operations (create stack, add/remove documents, create tables) use Supabase directly from the frontend - see `frontend/lib/queries/stacks.ts` in 01-foundation.md. This plan covers only the AI agent endpoints that trigger Claude Agent SDK operations.

**Prerequisites:**
- 05-agent-tools.md must be complete (provides `extract_stack_table` and `correct_stack_table` functions)

**Tech Stack:** FastAPI, Claude Agent SDK, Supabase Python client

---

## Task 1: Create Stack Agent Router

**Files:**
- Create: `backend/app/routes/stack.py`

**Step 1: Implement SSE extraction and correction endpoints**

Follow the exact pattern from `backend/app/routes/agent.py`:

```python
# backend/app/routes/stack.py

"""
Stack agent routes - SSE streaming for extraction and correction.

Endpoints:
- POST /api/stack/{stack_id}/tables/{table_id}/extract - Extract data (SSE)
- POST /api/stack/{stack_id}/tables/{table_id}/correct - Correct data (SSE)
"""

import json
import logging
from typing import AsyncIterator

from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import StreamingResponse

from ..agents.stack_agent import extract_stack_table, correct_stack_table
from ..auth import get_current_user
from ..database import get_supabase_client

router = APIRouter()
logger = logging.getLogger(__name__)


def sse_event(data: dict) -> str:
    """Format data as SSE event."""
    return f"data: {json.dumps(data)}\n\n"


@router.post("/{stack_id}/tables/{table_id}/extract")
async def extract_table_data(
    stack_id: str,
    table_id: str,
    user_id: str = Depends(get_current_user),
):
    """
    Extract data from all documents in stack to table.

    Args:
        stack_id: Stack UUID
        table_id: Table UUID
        user_id: From Clerk JWT

    Returns:
        SSE stream with events:
        - {"text": "..."} - Claude's response
        - {"tool": "...", "input": {...}} - Tool activity
        - {"complete": true, "table_id": "...", "session_id": "..."}
        - {"error": "..."}
    """
    db = get_supabase_client()

    # Verify stack belongs to user
    stack = db.table("stacks").select("id, name, description").eq("id", stack_id).eq("user_id", user_id).single().execute()
    if not stack.data:
        raise HTTPException(status_code=404, detail="Stack not found")

    # Verify table belongs to stack
    table = db.table("stack_tables").select("*").eq("id", table_id).eq("stack_id", stack_id).single().execute()
    if not table.data:
        raise HTTPException(status_code=404, detail="Table not found")

    # Get documents in stack
    stack_docs = db.table("stack_documents").select("document_id").eq("stack_id", stack_id).execute()
    document_ids = [sd["document_id"] for sd in (stack_docs.data or [])]

    if not document_ids:
        raise HTTPException(status_code=400, detail="No documents in stack")

    # Update table status
    db.table("stack_tables").update({"status": "processing"}).eq("id", table_id).execute()

    async def event_stream() -> AsyncIterator[str]:
        try:
            async for event in extract_stack_table(
                stack_id=stack_id,
                table_id=table_id,
                document_ids=document_ids,
                stack_description=stack.data.get("description"),
                table_config=table.data,
                user_id=user_id,
                db=db,
            ):
                yield sse_event(event)
        except Exception as e:
            logger.error(f"Stack extraction error: {e}")
            db.table("stack_tables").update({"status": "failed"}).eq("id", table_id).execute()
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


@router.post("/{stack_id}/tables/{table_id}/correct")
async def correct_table_data(
    stack_id: str,
    table_id: str,
    instruction: str = Form(...),
    user_id: str = Depends(get_current_user),
):
    """
    Correct table data with natural language instruction.

    Args:
        stack_id: Stack UUID
        table_id: Table UUID
        instruction: Correction instruction
        user_id: From Clerk JWT

    Returns:
        SSE stream with same event types as /extract
    """
    db = get_supabase_client()

    # Verify table belongs to stack and user
    table = db.table("stack_tables").select("session_id").eq("id", table_id).eq("stack_id", stack_id).single().execute()
    if not table.data:
        raise HTTPException(status_code=404, detail="Table not found")

    session_id = table.data.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="No extraction session to correct. Run extraction first.")

    async def event_stream() -> AsyncIterator[str]:
        try:
            async for event in correct_stack_table(
                session_id=session_id,
                table_id=table_id,
                instruction=instruction,
                user_id=user_id,
                db=db,
            ):
                yield sse_event(event)
        except Exception as e:
            logger.error(f"Stack correction error: {e}")
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

**Step 2: Commit**

```bash
git add backend/app/routes/stack.py
git commit -m "feat(backend): add stack agent SSE routes"
```

---

## Task 2: Register Stack Router

**Files:**
- Modify: `backend/app/main.py`

**Step 1: Import and register router with prefix**

```python
# Add import near other route imports:
from .routes.stack import router as stack_router

# Add in router registration section:
app.include_router(stack_router, prefix="/api/stack", tags=["stack"])
```

**Step 2: Commit**

```bash
git add backend/app/main.py
git commit -m "feat(backend): register stack agent router"
```
