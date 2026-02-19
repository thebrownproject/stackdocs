# Phase 2.1: Background Processing Chain

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor document upload to return instantly, running OCR and metadata generation as chained background tasks. Frontend tracks progress via Supabase Realtime.

**Architecture:** Upload returns immediately after saving file to storage. BackgroundTasks chain: Upload creates document record with `uploading` status, then spawns OCR task. OCR task runs Mistral API, updates status to `ocr_complete`, then directly awaits metadata task. Metadata task runs `document_processor_agent`. Frontend subscribes to `documents` table via Realtime.

**Tech Stack:** FastAPI BackgroundTasks, Mistral OCR API, Claude Agent SDK (document_processor_agent), Supabase Realtime

---

## Context

### Current Architecture (Being Replaced)
```
POST /api/document/upload
     |
     | (user waits 3-5 seconds for OCR)
     |
     v
Return { document_id, ocr_result }
```

### New Architecture
```
POST /api/document/upload
     |
     v (instant return with document_id, status: 'uploading')

BackgroundTask: _run_ocr_background()
     | - Creates signed URL
     | - Calls Mistral OCR API
     | - Saves to ocr_results table
     | - Updates document status: 'uploading' -> 'ocr_complete' or 'failed'
     |
     v on success, awaits metadata directly (no BackgroundTasks chaining)

_run_metadata_background() (awaited, not spawned)
     | - Calls document_processor_agent
     | - Agent writes display_name, tags, summary to documents table
     | - Failures logged but don't affect OCR status
     |
     v complete (frontend sees via Realtime)
```

**Note:** Background tasks cannot spawn other background tasks (no `BackgroundTasks` instance available in background context). Instead, `_run_ocr_background()` directly awaits `_run_metadata_background()` on success.

### Status Flow

| Status | Meaning | Frontend Shows |
|--------|---------|----------------|
| `uploading` | File uploaded, OCR pending | "Extracting text..." spinner |
| `processing` | OCR in progress | "Extracting text..." spinner |
| `ocr_complete` | OCR done, metadata may be pending | Check if metadata exists |
| `failed` | OCR failed | Error with "Retry" button |

**Note:** Metadata runs fire-and-forget. If metadata fails, document stays at `ocr_complete` (usable) and user can manually trigger via "Regenerate" button.

### Key Files

- `backend/app/routes/document.py` - Main file being refactored
- `backend/app/agents/document_processor_agent/agent.py` - Metadata agent (unchanged)
- `backend/CLAUDE.md` - Update with new flow
- `backend/app/routes/CLAUDE.md` - Update endpoint docs

---

## Task 1: Add Imports

**Files:**
- Modify: `/Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/app/routes/document.py`

**Step 1: Add BackgroundTasks to FastAPI imports**

Find this line (around line 12):

```python
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
```

Replace with:

```python
from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile, File, Form, HTTPException
```

**Step 2: Add process_document_metadata import at file top**

Find the imports section and add (after other agent imports, or with the existing imports):

```python
from ..agents.document_processor_agent.agent import process_document_metadata
```

**Note:** This import must be at the top of the file, not inside functions. Importing inside functions is an anti-pattern that causes issues with IDE tooling and makes dependencies harder to track.

**Step 3: Verify syntax**

Run: `python -m py_compile /Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/app/routes/document.py`

Expected: No output (syntax OK)

---

## Task 2: Create _run_ocr_background() Helper

**Files:**
- Modify: `/Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/app/routes/document.py` (add after line 24, before first route)

**Step 1: Add the OCR background task helper**

Add this function after `logger = logging.getLogger(__name__)` (line 24) and before `@router.post("/document/upload")`:

```python
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
```

**Step 2: Verify syntax**

Run: `python -m py_compile /Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/app/routes/document.py`

Expected: No output (syntax OK)

---

## Task 3: Create _run_metadata_background() Helper

**Files:**
- Modify: `/Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/app/routes/document.py` (add after _run_ocr_background)

**Step 1: Add the metadata background task helper**

Add this function immediately after `_run_ocr_background()`:

```python
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
```

**Step 2: Verify syntax**

Run: `python -m py_compile /Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/app/routes/document.py`

Expected: No output (syntax OK)

---

## Task 4: Refactor upload_and_ocr() to Instant Return

**Files:**
- Modify: `/Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/app/routes/document.py:27-122` (the entire upload_and_ocr function)

**Step 1: Replace the entire upload_and_ocr function**

Find and replace the entire function (lines 27-122 approximately):

```python
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
```

**Step 2: Verify syntax**

Run: `python -m py_compile /Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/app/routes/document.py`

Expected: No output (syntax OK)

---

## Task 5: Refactor retry_ocr() to Use Background Tasks

**Files:**
- Modify: `/Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/app/routes/document.py` (retry_ocr function)

**Step 1: Replace the entire retry_ocr function**

Find and replace the `retry_ocr` function (currently after upload_and_ocr):

```python
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
```

**Step 2: Verify syntax**

Run: `python -m py_compile /Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/app/routes/document.py`

Expected: No output (syntax OK)

---

## Task 6: Manual Test

**Step 1: Start the backend server**

```bash
cd /Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend && uvicorn app.main:app --reload --port 8000
```

**Step 2: Upload a test document via curl**

```bash
curl -X POST "http://localhost:8000/api/document/upload" \
  -H "Authorization: Bearer <your-clerk-token>" \
  -F "file=@/path/to/test.pdf"
```

Expected response (instant, ~100ms):
```json
{
  "document_id": "uuid-here",
  "filename": "test.pdf",
  "status": "uploading"
}
```

**Step 3: Watch server logs**

Should see this sequence:
1. `[<uuid>] Document uploaded, queuing OCR` (immediate)
2. `[<uuid>] Background OCR starting` (after response returns)
3. `[<uuid>] Background OCR complete` (after 2-5 seconds)
4. `[<uuid>] Metadata tool: read_ocr` (chained await)
5. `[<uuid>] Metadata tool: save_metadata`
6. `[<uuid>] Metadata generation complete`

**Step 4: Verify database state**

Check `documents` table. Document should have:
- `status`: `ocr_complete`
- `display_name`: AI-generated name (populated by metadata agent)
- `tags`: Array of tags
- `summary`: 1-2 sentence description

**Step 5: Test failure recovery**

Test with invalid file or simulate Mistral API failure:
- Document should have `status: 'failed'`
- `POST /api/document/retry-ocr` should queue retry
- After retry, document should be `ocr_complete`

**Step 6: Test manual metadata regeneration**

Verify the existing `/api/document/metadata` endpoint still works (for "Regenerate" button functionality):

```bash
curl -X POST "http://localhost:8000/api/document/metadata" \
  -H "Authorization: Bearer <your-clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{"document_id": "<uuid-from-step-2>"}'
```

Expected: SSE stream with metadata generation events. This endpoint is used when users click "Regenerate" to re-run metadata extraction.

**Step 7: Stop server**

Ctrl+C to stop uvicorn

---

## Task 7: Update Backend CLAUDE.md

**Files:**
- Modify: `/Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/CLAUDE.md`

**Step 1: Update the API Endpoints table**

Find this section (around line 40-47):

```markdown
## API Endpoints

| Route File | Endpoints |
|------------|-----------|
| `document.py` | `/api/document/upload`, `/api/document/retry-ocr` |
| `agent.py` | `/api/agent/extract`, `/api/agent/correct`, `/api/agent/health` |
| `test.py` | `/api/test/claude`, `/api/test/mistral` |
```

Replace with:

```markdown
## API Endpoints

| Route File | Endpoints |
|------------|-----------|
| `document.py` | `/api/document/upload`, `/api/document/retry-ocr`, `/api/document/metadata` |
| `agent.py` | `/api/agent/extract`, `/api/agent/correct`, `/api/agent/health` |
| `test.py` | `/api/test/claude`, `/api/test/mistral` |

## Document Processing Flow

```
Upload (instant return)
     |
     v
BackgroundTask: OCR processing
     | - Updates status: 'uploading' -> 'processing' -> 'ocr_complete'
     | - On failure: status -> 'failed'
     |
     v on success (direct await, not BackgroundTasks chaining)
Metadata generation (fire-and-forget)
     | - Writes display_name, tags, summary to documents table
     | - Failures logged but don't affect OCR status
```

- **Frontend tracking:** Supabase Realtime subscription on `documents` table
- **Manual regenerate:** `POST /api/document/metadata` (SSE stream)
- **Retry failed OCR:** `POST /api/document/retry-ocr`
```

---

## Task 8: Update Routes CLAUDE.md

**Files:**
- Modify: `/Users/fraserbrown/stackdocs/.worktrees/documents-redesign/backend/app/routes/CLAUDE.md`

**Step 1: Update the Endpoints table**

Find this row:

```markdown
| `/api/document/upload` | POST | JWT | Upload file, run OCR, save to `ocr_results` |
```

Replace with:

```markdown
| `/api/document/upload` | POST | JWT | Upload file (instant), queue OCR + metadata as background tasks |
| `/api/document/retry-ocr` | POST | JWT | Retry OCR on failed documents (queues background task) |
```

**Step 2: Update Status Flow in Key Patterns**

Find this line:

```markdown
- **Status Flow**: Documents go `processing` -> `ocr_complete` or `failed`. Extractions have `in_progress` -> `complete`
```

Replace with:

```markdown
- **Status Flow**: Documents go `uploading` -> `processing` -> `ocr_complete` or `failed`. Extractions have `in_progress` -> `complete`

- **Background Task Chain**: `upload_and_ocr()` queues `_run_ocr_background()` which directly awaits `_run_metadata_background()` on success. Frontend tracks via Supabase Realtime. Note: Background tasks cannot spawn other background tasks (no `BackgroundTasks` instance available in background context).
```

---

## Task 9: Commit

**Step 1: Stage and commit**

```bash
cd /Users/fraserbrown/stackdocs/.worktrees/documents-redesign && git add backend/app/routes/document.py backend/CLAUDE.md backend/app/routes/CLAUDE.md && git commit -m "$(cat <<'EOF'
feat(backend): refactor upload to instant return with background processing

- Add BackgroundTasks import to document.py
- Add process_document_metadata import at file top
- Create _run_ocr_background() for async OCR processing
- Create _run_metadata_background() for fire-and-forget metadata generation
- Refactor upload_and_ocr() to return immediately after file upload
- Refactor retry_ocr() to use background task pattern
- OCR task directly awaits metadata task (cannot chain BackgroundTasks)
- Add 'uploading' status for immediate post-upload state
- Use consistent [document_id] log prefix format
- Update CLAUDE.md docs with new processing flow

Breaking change: Response no longer includes ocr_result.
Frontend must use Supabase Realtime to track processing status.
EOF
)"
```

---

## Summary

After completing all tasks, the flow will be:

1. User uploads document
2. **NEW:** Response returns instantly with `status: 'uploading'`
3. **NEW:** Background task runs OCR (updates status via Supabase)
4. **NEW:** On OCR success, directly awaits metadata generation (not BackgroundTasks chaining)
5. Frontend sees updates via Realtime subscription (existing capability)
6. Document ends at `ocr_complete` with metadata populated
7. Manual "Regenerate" still works via `/api/document/metadata` (existing endpoint)

**Files Modified:**
- `backend/app/routes/document.py` - Refactored to instant return + background chain
- `backend/CLAUDE.md` - Added processing flow documentation
- `backend/app/routes/CLAUDE.md` - Updated endpoint descriptions + status flow

**Breaking Changes:**
- `POST /api/document/upload` no longer returns `ocr_result` in response
- Frontend must use Supabase Realtime to track status changes
- New `uploading` status added before `processing`

**Error Handling:**
- OCR failure: Document status set to `failed`, user can retry via `/api/document/retry-ocr`
- Metadata failure: Logged but document stays at `ocr_complete` (usable), user can manually trigger via "Regenerate" button

**Technical Note - Why Direct Await:**
Background tasks run outside the request context, so they don't have access to a `BackgroundTasks` instance. You cannot call `background_tasks.add_task()` from within a background task. Instead, `_run_ocr_background()` directly awaits `_run_metadata_background()` on success. This is the correct pattern for chaining async operations in background tasks.

---

## Acceptance Criteria

- [ ] `POST /api/document/upload` returns in <200ms (no OCR blocking)
- [ ] Response includes `status: 'uploading'` (not `ocr_complete`)
- [ ] Server logs show background OCR starting after response
- [ ] Document status progresses: `uploading` -> `processing` -> `ocr_complete`
- [ ] Metadata is populated after OCR completes
- [ ] `POST /api/document/retry-ocr` works for failed documents
- [ ] `POST /api/document/metadata` works for manual regeneration
- [ ] Failed OCR sets `status: 'failed'` (not exception to client)
- [ ] CLAUDE.md docs updated with new flow
- [ ] Log messages use consistent `[document_id]` prefix format
