# OCR 3 Upgrade + Document Upload Endpoint - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade to Mistral OCR 3 and create a new `/api/document/upload` endpoint that returns OCR results synchronously.

**Architecture:** Replace the background-task-based `/api/process` endpoint with a synchronous `/api/document/upload` endpoint. Update OCR service to use OCR 3 model with HTML table extraction. Store HTML tables in new database column.

**API Structure (confirmed):**
```
Document Operations (document.py):
  POST /api/document/upload      → Upload + OCR (new files)
  POST /api/document/retry-ocr   → Re-run OCR (existing files, retry failed)

Agent Operations (agent.py):
  POST /api/agent/extract        → AI extraction (SSE stream)
  POST /api/agent/correct        → AI correction (SSE stream)
  GET  /api/agent/health         → Health check

Service Tests (test.py):
  GET  /api/test/claude          → Test Claude
  GET  /api/test/mistral         → Test Mistral
```

> **Note:** Agent endpoints stay in `agent.py` - separation of concerns. Document upload/OCR is separate from AI extraction.

**Files to delete:**
- `routes/process.py` - Both `/api/process` and `/api/re-extract` replaced
- `services/extractor.py` - Only used by process.py, agent uses `extraction_agent` instead

**Tech Stack:** FastAPI, Mistral OCR 3 (`mistral-ocr-2512`), Supabase PostgreSQL

---

## ⚠️ Pre-requisite: Upgrade Mistral SDK

OCR 3 was released 2025-12-21. Current SDK (v1.9.11) predates this.

```bash
cd /Users/fraserbrown/stackdocs/backend
pip install --upgrade mistralai
pip show mistralai  # Verify new version
```

After upgrading, verify the new SDK supports `table_format` parameter and `tables` response field before proceeding.

---

## Task 1: Database Migration

**Files:**
- Create: `backend/migrations/008_add_html_tables.sql`

**Step 1: Create migration file**

```sql
-- Migration: 008_add_html_tables.sql
-- Description: Add html_tables column for OCR 3 HTML table output

ALTER TABLE ocr_results
ADD COLUMN html_tables JSONB;

COMMENT ON COLUMN ocr_results.html_tables IS 'HTML table strings from OCR 3 for frontend rendering';
```

**Step 2: Apply migration to Supabase**

Run in Supabase SQL Editor:
```sql
ALTER TABLE ocr_results
ADD COLUMN html_tables JSONB;

COMMENT ON COLUMN ocr_results.html_tables IS 'HTML table strings from OCR 3 for frontend rendering';
```

Expected: Query executes successfully, column added.

**Step 3: Verify column exists**

Run in Supabase SQL Editor:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ocr_results' AND column_name = 'html_tables';
```

Expected: Returns one row with `html_tables | jsonb`

**Step 4: Commit**

```bash
git add backend/migrations/006_add_html_tables.sql
git commit -m "db: Add html_tables column for OCR 3"
```

---

## Task 2: Update OCR Service for OCR 3

**Files:**
- Modify: `backend/app/services/ocr.py`

**Step 1: Update OCRResult TypedDict**

In `backend/app/services/ocr.py`, find the `OCRResult` class (lines 31-41) and add the `html_tables` field:

```python
class OCRResult(TypedDict):
    """Result from OCR text extraction."""
    text: str
    status: str
    errors: list[str]
    page_count: int
    processing_time_ms: int
    model: str
    usage_info: dict[str, Any]
    layout_data: dict[str, Any] | None
    document_annotation: str | None
    html_tables: list[str] | None  # NEW: HTML tables from OCR 3
```

**Step 2: Add helper function to extract tables**

Add this function after `_extract_usage_info` (around line 100):

```python
def _extract_html_tables(pages: list[Any]) -> list[str] | None:
    """Extract HTML table content from all pages.

    OCR 3 returns tables as objects: {"id": "tbl-0", "format": "html", "content": "<table>..."}
    We extract just the content strings for storage.
    """
    tables: list[str] = []
    for page in pages:
        if page_tables := getattr(page, 'tables', None):
            for table in page_tables:
                if content := getattr(table, 'content', None):
                    tables.append(content)
    return tables if tables else None
```

**Step 3: Update API call to use OCR 3**

In the `extract_text_ocr` function, find the `_call_ocr` function (lines 123-128) and update:

```python
        def _call_ocr():
            return client.ocr.process(
                model="mistral-ocr-2512",
                document={"type": "document_url", "document_url": document_url},
                table_format="html",
                include_image_base64=False
            )
```

**Step 4: Update return statement to include html_tables**

Find the return statement (lines 157-167) and update:

```python
        return {
            "text": extracted_text,
            "status": "success",
            "errors": [],
            "page_count": page_count,
            "processing_time_ms": processing_time_ms,
            "model": model,
            "usage_info": _extract_usage_info(response),
            "layout_data": {"pages": layout_pages} if layout_pages else None,
            "document_annotation": getattr(response, 'document_annotation', None),
            "html_tables": _extract_html_tables(response.pages),  # NEW
        }
```

**Step 5: Verify file syntax**

```bash
cd /Users/fraserbrown/stackdocs/backend && python -m py_compile app/services/ocr.py
```

Expected: No output (successful compilation)

**Step 6: Commit**

```bash
git add backend/app/services/ocr.py
git commit -m "feat: Update OCR service to use Mistral OCR 3

- Change model to mistral-ocr-2512
- Add table_format=html parameter
- Extract HTML tables from response
- Add html_tables to OCRResult"
```

---

## Task 3: Create Document Upload Route

**Files:**
- Create: `backend/app/routes/document.py`

**Step 1: Create the new route file**

Create `backend/app/routes/document.py`:

```python
"""
Document upload endpoint - OCR only.

Handles document upload and OCR processing synchronously.
Extraction is handled separately via /api/document/extract.
"""

import logging
from typing import Any

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from ..services.storage import upload_document, create_signed_url
from ..services.ocr import extract_text_ocr
from ..services.usage import check_usage_limit, increment_usage
from ..database import get_supabase_client

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/document/upload")
async def upload_and_ocr(
    file: UploadFile = File(...),  # pyright: ignore[reportCallInDefaultInitializer]
    user_id: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
) -> dict[str, Any]:
    """
    Upload document and run OCR (synchronous).

    Returns full OCR result directly - no background processing.
    Frontend can immediately show document preview after this completes.

    Args:
        file: Document file (PDF, JPG, PNG)
        user_id: User UUID

    Returns:
        document_id, filename, status, ocr_result
    """
    # Check usage limit
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
        # Create document record with 'processing' status
        supabase.table("documents").insert({
            "id": document_id,
            "user_id": user_id,
            "filename": upload_result["filename"],
            "file_path": upload_result["file_path"],
            "file_size_bytes": upload_result["file_size_bytes"],
            "mime_type": upload_result["mime_type"],
            "mode": "auto",  # Default, will be set properly during extraction
            "status": "processing",
        }).execute()

        # Get signed URL and run OCR
        logger.info(f"Starting OCR for document {document_id}")
        signed_url = await create_signed_url(str(upload_result["file_path"]))
        ocr_result = await extract_text_ocr(signed_url)

        # Save OCR result
        supabase.table("ocr_results").upsert({
            "document_id": document_id,
            "user_id": user_id,
            "raw_text": ocr_result["text"],
            "html_tables": ocr_result.get("html_tables"),
            "page_count": ocr_result.get("page_count", 1),
            "model": ocr_result.get("model", "mistral-ocr-2512"),
            "processing_time_ms": ocr_result.get("processing_time_ms", 0),
            "usage_info": ocr_result.get("usage_info", {}),
            "layout_data": ocr_result.get("layout_data"),
        }).execute()

        # Update document status to ocr_complete
        supabase.table("documents").update({
            "status": "ocr_complete"
        }).eq("id", document_id).execute()

        # Increment usage counter
        await increment_usage(user_id)

        logger.info(f"OCR complete for document {document_id}")

        return {
            "document_id": document_id,
            "filename": upload_result["filename"],
            "status": "ocr_complete",
            "ocr_result": {
                "raw_text": ocr_result["text"],
                "html_tables": ocr_result.get("html_tables"),
                "page_count": ocr_result.get("page_count", 1),
                "processing_time_ms": ocr_result.get("processing_time_ms", 0),
                "model": ocr_result.get("model", "mistral-ocr-2512"),
            }
        }

    except Exception as e:
        logger.error(f"OCR failed for document {document_id}: {e}")
        # Update document status to failed
        supabase.table("documents").update({
            "status": "failed"
        }).eq("id", document_id).execute()
        raise HTTPException(
            status_code=500,
            detail=f"OCR processing failed: {str(e)}"
        )
```

**Step 2: Verify file syntax**

```bash
cd /Users/fraserbrown/stackdocs/backend && python -m py_compile app/routes/document.py
```

Expected: No output (successful compilation)

**Step 3: Add retry-ocr endpoint**

Add after the `upload_and_ocr` function:

```python
@router.post("/document/retry-ocr")
async def retry_ocr(
    document_id: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
    user_id: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
) -> dict[str, Any]:
    """
    Retry OCR on an existing document (for failed OCR recovery).

    Use when:
    - File uploaded successfully but OCR failed
    - User clicks "Retry" button after error

    Args:
        document_id: Existing document UUID
        user_id: User UUID

    Returns:
        document_id, status, ocr_result
    """
    supabase = get_supabase_client()

    # Verify document exists and user owns it
    doc = supabase.table("documents").select("file_path, filename").eq("id", document_id).eq("user_id", user_id).single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    # Update status to processing
    supabase.table("documents").update({
        "status": "processing"
    }).eq("id", document_id).execute()

    try:
        # Get signed URL and run OCR
        logger.info(f"Retrying OCR for document {document_id}")
        signed_url = await create_signed_url(doc.data["file_path"])
        ocr_result = await extract_text_ocr(signed_url)

        # Save/update OCR result
        supabase.table("ocr_results").upsert({
            "document_id": document_id,
            "user_id": user_id,
            "raw_text": ocr_result["text"],
            "html_tables": ocr_result.get("html_tables"),
            "page_count": ocr_result.get("page_count", 1),
            "model": ocr_result.get("model", "mistral-ocr-2512"),
            "processing_time_ms": ocr_result.get("processing_time_ms", 0),
            "usage_info": ocr_result.get("usage_info", {}),
            "layout_data": ocr_result.get("layout_data"),
        }).execute()

        # Update document status
        supabase.table("documents").update({
            "status": "ocr_complete"
        }).eq("id", document_id).execute()

        logger.info(f"OCR retry complete for document {document_id}")

        return {
            "document_id": document_id,
            "filename": doc.data["filename"],
            "status": "ocr_complete",
            "ocr_result": {
                "raw_text": ocr_result["text"],
                "html_tables": ocr_result.get("html_tables"),
                "page_count": ocr_result.get("page_count", 1),
                "processing_time_ms": ocr_result.get("processing_time_ms", 0),
                "model": ocr_result.get("model", "mistral-ocr-2512"),
            }
        }

    except Exception as e:
        logger.error(f"OCR retry failed for document {document_id}: {e}")
        supabase.table("documents").update({
            "status": "failed"
        }).eq("id", document_id).execute()
        raise HTTPException(
            status_code=500,
            detail=f"OCR processing failed: {str(e)}"
        )
```

**Step 4: Verify file syntax**

```bash
cd /Users/fraserbrown/stackdocs/backend && python -m py_compile app/routes/document.py
```

Expected: No output (successful compilation)

**Step 5: Commit**

```bash
git add backend/app/routes/document.py
git commit -m "feat: Add /api/document/upload and /api/document/retry-ocr endpoints

- /api/document/upload: Synchronous upload + OCR for new files
- /api/document/retry-ocr: Retry OCR on existing documents (failed OCR recovery)
Both set document status to 'ocr_complete' when done."
```

---

## Task 4: Update Main App Router Registration

**Files:**
- Modify: `backend/app/main.py`

**Step 1: Update imports**

In `backend/app/main.py`, find line 7:
```python
from .routes import process, agent, test
```

Replace with:
```python
from .routes import document, agent, test
```

**Step 2: Update router registration**

Find line 53:
```python
app.include_router(process.router, prefix="/api", tags=["processing"])
```

Replace with:
```python
app.include_router(document.router, prefix="/api", tags=["document"])
```

> **Note:** Keep `test.router` registration - it was added for service connectivity tests.

**Step 3: Verify file syntax**

```bash
cd /Users/fraserbrown/stackdocs/backend && python -m py_compile app/main.py
```

Expected: No output (successful compilation)

**Step 4: Commit**

```bash
git add backend/app/main.py
git commit -m "refactor: Replace process router with document router

- Remove deprecated /api/process and /api/re-extract endpoints
- Add new /api/document/upload endpoint"
```

---

## Task 5: Delete Deprecated Files

**Files:**
- Delete: `backend/app/routes/process.py`
- Delete: `backend/app/services/extractor.py`

**Step 1: Delete deprecated route**

```bash
rm /Users/fraserbrown/stackdocs/backend/app/routes/process.py
```

**Step 2: Delete deprecated service**

```bash
rm /Users/fraserbrown/stackdocs/backend/app/services/extractor.py
```

> **Note:** `extractor.py` was only used by `process.py`. The agent uses `extraction_agent` instead.

**Step 3: Verify deletions**

```bash
ls /Users/fraserbrown/stackdocs/backend/app/routes/
ls /Users/fraserbrown/stackdocs/backend/app/services/
```

Expected routes: `__init__.py`, `agent.py`, `document.py`, `test.py`
Expected services: `__init__.py`, `ocr.py`, `storage.py`, `usage.py`

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: Remove deprecated process.py and extractor.py

Deleted:
- routes/process.py: /api/process and /api/re-extract replaced by /api/document/* and /api/agent/*
- services/extractor.py: Agent uses extraction_agent instead"
```

---

## Task 6: Manual Verification

**Step 1: Start the server**

```bash
cd /Users/fraserbrown/stackdocs/backend && uvicorn app.main:app --reload --port 8001
```

Expected: Server starts without errors

**Step 2: Check Swagger docs**

Open: http://localhost:8001/docs

Expected:
- See `POST /api/document/upload` endpoint
- See `POST /api/document/retry-ocr` endpoint
- See `/api/agent/*` endpoints (extract, correct, health)
- See `/api/test/*` endpoints (claude, mistral)
- NOT see `/api/process` or `/api/re-extract`

**Step 3: Test health endpoint**

```bash
curl http://localhost:8001/health
```

Expected: `{"status":"ok",...}`

**Step 4: Stop server**

Press Ctrl+C to stop the server.

> **Note:** Full table validation happens in Task 8. This task just verifies the server runs.

---

## Task 7: Update Documentation

**Files:**
- Modify: `docs/SCHEMA.md`
- Modify: `docs/ARCHITECTURE.md`

**Step 1: Update SCHEMA.md**

Add to the `ocr_results` table section:

```markdown
| html_tables | JSONB | HTML table strings from OCR 3 |
```

Update document status values section to include:

```markdown
**Document Status Values:**
| Status | Meaning |
|--------|---------|
| `processing` | Upload/OCR in progress |
| `ocr_complete` | OCR done, ready for extraction |
| `failed` | Something went wrong |
```

**Step 2: Update ARCHITECTURE.md**

Update the API Endpoints section to reflect:
- Remove `/api/process` and `/api/re-extract`
- Add `/api/document/upload`

**Step 3: Commit**

```bash
git add docs/SCHEMA.md docs/ARCHITECTURE.md
git commit -m "docs: Update schema and architecture for OCR 3 upgrade

- Add html_tables column to ocr_results
- Document ocr_complete status
- Update endpoint documentation"
```

---

## Task 8: Final Verification & Cleanup

**Step 1: Run full test**

```bash
cd /Users/fraserbrown/stackdocs/backend && uvicorn app.main:app --reload --port 8001
```

**Step 2: Test with a document WITHOUT tables**

Using Swagger UI at http://localhost:8001/docs:
1. Navigate to `POST /api/document/upload`
2. Upload a simple PDF/image (no tables)
3. Provide a valid `user_id`
4. Execute

Expected response:
```json
{
  "document_id": "...",
  "filename": "...",
  "status": "ocr_complete",
  "ocr_result": {
    "raw_text": "...",
    "html_tables": null,
    "page_count": 1,
    "processing_time_ms": ...,
    "model": "mistral-ocr-2512"
  }
}
```

**Step 3: Test with a document WITH tables**

Upload an invoice or form containing tables. Verify:
1. `html_tables` is an array of HTML strings (not objects)
2. Each entry starts with `<table` and ends with `</table>`
3. `raw_text` contains the markdown with table placeholders

Example expected `html_tables`:
```json
["<table><tr><th>Item</th><th>Price</th></tr>...</table>"]
```

> **Important:** Check the markdown (`raw_text`) for table placeholders. They may look like `[tbl-0.html](tbl-0.html)` or similar. Document the actual format for Phase 2 frontend work.

**Step 4: Verify database**

Check Supabase to confirm:
- Document record has `status = 'ocr_complete'`
- `ocr_results.html_tables` contains valid JSON array of HTML strings
- `ocr_results.model` is `mistral-ocr-2512`

**Step 5: Move plan to complete**

```bash
git mv docs/plans/in-progress/ocr-3-upgrade docs/plans/complete/
git commit -m "chore: Move OCR 3 upgrade plan to complete"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Database migration | `backend/migrations/006_add_html_tables.sql` |
| 2 | OCR service update | `backend/app/services/ocr.py` |
| 3 | New document route | `backend/app/routes/document.py` |
| 4 | Update main app | `backend/app/main.py` |
| 5 | Delete old route | `backend/app/routes/process.py` |
| 6 | Manual verification | - |
| 7 | Update docs | `docs/SCHEMA.md`, `docs/ARCHITECTURE.md` |
| 8 | Final test & cleanup | - |
