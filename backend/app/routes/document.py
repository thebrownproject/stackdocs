"""
Document upload endpoint - OCR only.

Handles document upload and OCR processing synchronously.
Extraction is handled separately via /api/agent/extract.
Metadata generation via /api/document/metadata.
"""

import logging
from typing import Any, AsyncIterator

from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse

from ..agents.document_processor_agent import process_document_metadata
from ..auth import get_current_user
from ..services.storage import upload_document, create_signed_url
from ..services.ocr import extract_text_ocr
from ..services.usage import check_usage_limit, increment_usage
from ..database import get_supabase_client
from ..utils.sse import sse_event

router = APIRouter()
logger = logging.getLogger(__name__)


async def _run_ocr_background(
    document_id: str,
    file_path: str,
    user_id: str,
) -> None:
    """
    Run OCR processing in background.

    On success: Updates status to 'ocr_complete' and awaits metadata generation.
    On failure: Updates status to 'failed'.

    Note: Background tasks cannot spawn other background tasks (no BackgroundTasks
    instance available). Instead, we directly await _run_metadata_background().

    Args:
        document_id: Document UUID
        file_path: Path in Supabase Storage
        user_id: User who uploaded the document
    """
    supabase = get_supabase_client()

    try:
        # Update status to processing (OCR starting)
        supabase.table("documents").update({
            "status": "processing"
        }).eq("id", document_id).execute()

        # Get signed URL and run OCR
        logger.info(f"[{document_id}] Background OCR starting")
        signed_url = await create_signed_url(file_path)
        ocr_result = await extract_text_ocr(signed_url)

        # Save OCR result
        supabase.table("ocr_results").upsert({
            "document_id": document_id,
            "user_id": user_id,
            "raw_text": ocr_result["text"],
            "html_tables": ocr_result.get("html_tables"),
            "page_count": ocr_result.get("page_count", 1),
            "model": ocr_result.get("model", "mistral-ocr-latest"),
            "processing_time_ms": ocr_result.get("processing_time_ms", 0),
            "usage_info": ocr_result.get("usage_info", {}),
            "layout_data": ocr_result.get("layout_data"),
        }).execute()

        # Update document status to ocr_complete
        supabase.table("documents").update({
            "status": "ocr_complete"
        }).eq("id", document_id).execute()

        # Increment usage counter (OCR success = billable event)
        await increment_usage(user_id)

        logger.info(f"[{document_id}] Background OCR complete")

        # Chain: directly await metadata generation (cannot use BackgroundTasks here)
        await _run_metadata_background(document_id, user_id)

    except Exception as e:
        logger.error(f"[{document_id}] Background OCR failed: {e}")
        # Update document status to failed
        supabase.table("documents").update({
            "status": "failed"
        }).eq("id", document_id).execute()


async def _run_metadata_background(
    document_id: str,
    user_id: str,
) -> None:
    """
    Run metadata generation in background (fire-and-forget).

    Consumes all events from the agent and logs completion/errors.
    Does not propagate exceptions - OCR already succeeded.
    Failures are logged but document stays at 'ocr_complete' (usable).
    """
    try:
        supabase = get_supabase_client()
        async for event in process_document_metadata(
            document_id=document_id,
            user_id=user_id,
            db=supabase,
        ):
            # Log tool usage for debugging (optional, can remove if too noisy)
            if "tool" in event:
                logger.debug(f"[{document_id}] Metadata tool: {event['tool']}")
            elif "complete" in event:
                logger.info(f"[{document_id}] Metadata generation complete")
            elif "error" in event:
                logger.error(f"[{document_id}] Metadata generation failed: {event['error']}")
    except Exception as e:
        # Log but don't propagate - OCR already succeeded, document is usable
        logger.error(f"[{document_id}] Background metadata task failed: {e}")


@router.post("/document/upload")
async def upload_and_ocr(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),  # pyright: ignore[reportCallInDefaultInitializer]
    user_id: str = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Upload document and queue OCR processing (async background).

    Returns immediately after file upload. OCR runs in background.
    Frontend watches progress via Supabase Realtime subscription.

    Status flow:
    - 'uploading' -> File saved, OCR queued
    - 'processing' -> OCR in progress (set by background task)
    - 'ocr_complete' -> Ready for extraction
    - 'failed' -> OCR error (use retry-ocr endpoint)

    Args:
        background_tasks: FastAPI BackgroundTasks for async processing
        file: Document file (PDF, JPG, PNG)
        user_id: From Clerk JWT (injected via auth dependency)

    Returns:
        document_id, filename, status (always 'uploading')
    """
    # Check usage limit before upload
    can_upload = await check_usage_limit(user_id)
    if not can_upload:
        raise HTTPException(
            status_code=403,
            detail="Upload limit reached. Please upgrade your plan."
        )

    # Upload file to Supabase Storage
    upload_result = await upload_document(user_id, file)
    document_id = str(upload_result["document_id"])

    supabase = get_supabase_client()

    try:
        # Create document record with 'uploading' status
        supabase.table("documents").insert({
            "id": document_id,
            "user_id": user_id,
            "filename": upload_result["filename"],
            "file_path": upload_result["file_path"],
            "file_size_bytes": upload_result["file_size_bytes"],
            "mime_type": upload_result["mime_type"],
            "mode": "auto",  # Default, will be set properly during extraction
            "status": "uploading",
        }).execute()

        logger.info(f"[{document_id}] Document uploaded, queuing OCR")

        # Queue OCR as background task (runs after response returns)
        # Note: _run_ocr_background will await _run_metadata_background directly
        background_tasks.add_task(
            _run_ocr_background,
            document_id,
            upload_result["file_path"],
            user_id,
        )

        # Return immediately - frontend watches via Realtime
        return {
            "document_id": document_id,
            "filename": upload_result["filename"],
            "status": "uploading",
        }

    except Exception as e:
        logger.error(f"[{document_id}] Upload failed: {e}")
        # Clean up: delete from storage if DB insert failed
        try:
            from ..services.storage import delete_document
            await delete_document(upload_result["file_path"])
        except Exception:
            pass  # Best effort cleanup
        raise HTTPException(
            status_code=500,
            detail=f"Upload failed: {str(e)}"
        )


@router.post("/document/retry-ocr")
async def retry_ocr(
    background_tasks: BackgroundTasks,
    document_id: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
    user_id: str = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Retry OCR on a failed document (async background).

    Use when:
    - File uploaded successfully but OCR failed
    - User clicks "Retry" button after error

    Returns immediately. OCR runs in background.
    Frontend watches progress via Supabase Realtime.

    Args:
        background_tasks: FastAPI BackgroundTasks for async processing
        document_id: Existing document UUID
        user_id: From Clerk JWT (injected via auth dependency)

    Returns:
        document_id, filename, status (always 'uploading')
    """
    supabase = get_supabase_client()

    # Verify document exists and user owns it
    doc = supabase.table("documents").select("file_path, filename, status").eq("id", document_id).eq("user_id", user_id).single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    # Only allow retry on failed documents
    if doc.data.get("status") not in ["failed", "uploading"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot retry OCR on document with status: {doc.data.get('status')}. Only 'failed' documents can be retried."
        )

    # Reset status to uploading and queue OCR
    supabase.table("documents").update({
        "status": "uploading"
    }).eq("id", document_id).execute()

    logger.info(f"[{document_id}] Retrying OCR")

    # Queue OCR as background task
    # Note: _run_ocr_background will await _run_metadata_background directly
    background_tasks.add_task(
        _run_ocr_background,
        document_id,
        doc.data["file_path"],
        user_id,
    )

    return {
        "document_id": document_id,
        "filename": doc.data["filename"],
        "status": "uploading",
    }


@router.post("/document/metadata")
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
