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

from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import StreamingResponse

from ..agents.extraction_agent import extract_with_agent, correct_with_session
from ..auth import get_current_user
from ..database import get_supabase_client
from ..utils.sse import sse_event

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/extract")
async def extract_with_streaming(
    document_id: str = Form(...),
    mode: str = Form("auto"),
    custom_fields: str | None = Form(None),
    user_id: str = Depends(get_current_user),
):
    """
    Extract from document with SSE streaming.

    Creates extraction record first, then runs agent.
    Agent writes directly to database via tools.

    Args:
        document_id: Document UUID (must have OCR cached)
        mode: "auto" or "custom"
        custom_fields: Comma-separated field names (required if mode=custom)
        user_id: From Clerk JWT (injected via auth dependency)

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

    # Parse custom fields - supports both JSON format and comma-separated
    fields_list: list[dict] | list[str] | None = None
    if custom_fields:
        try:
            # Try JSON format first: [{"name": "...", "description": "..."}]
            parsed = json.loads(custom_fields)
            if isinstance(parsed, list) and len(parsed) > 0:
                # Validate structure - all items must be dicts with string 'name' key
                def is_valid_field(item) -> bool:
                    return (
                        isinstance(item, dict)
                        and 'name' in item
                        and isinstance(item['name'], str)
                        and item['name'].strip() != ''
                        and ('description' not in item or isinstance(item.get('description'), str))
                    )

                if all(is_valid_field(item) for item in parsed):
                    fields_list = parsed
                else:
                    # Invalid structure, fall back to comma-separated
                    fields_list = [f.strip() for f in custom_fields.split(",") if f.strip()]
            else:
                fields_list = []
        except json.JSONDecodeError:
            # Fall back to comma-separated format for backwards compatibility
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
    instruction: str = Form(...),
    user_id: str = Depends(get_current_user),
):
    """
    Correct extraction using session resume.

    Args:
        document_id: Document UUID
        instruction: Correction instruction
        user_id: From Clerk JWT (injected via auth dependency)

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
