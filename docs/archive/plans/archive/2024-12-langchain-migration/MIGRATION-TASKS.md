# Migration Tasks: Hybrid Architecture Implementation

**Date**: 2025-12-16
**Status**: ✅ Complete
**Related**: `MIGRATION-PLAN.md`, `ARCHITECTURE-UPDATE.md`
**Purpose**: Step-by-step tasks to migrate Stackdocs to hybrid architecture

---

## Task Tracking

Use `/resume` command after clearing chat to check status and continue work.

### Phase 1: Dependencies & Configuration

- [x] **1.1** Update `requirements.txt` (remove langchain, add anthropic)
- [x] **1.2** Update `app/config.py` (ANTHROPIC_API_KEY, CLAUDE_MODEL)
- [x] **1.3** Update `.env` and `.env.example`

### Phase 2: Rewrite Extraction Service

- [x] **2.1** Replace `app/services/extractor.py` with Anthropic SDK

### Phase 3: Consolidate FastAPI Routes

- [x] **3.1** Create `app/routes/process.py` (new consolidated endpoints)
- [x] **3.2** Update `app/main.py` (router registration)
- [x] **3.3** Delete old route files (documents.py, ocr.py, extractions.py, usage.py)

### Phase 4: Testing & Validation

- [x] **4.1** Test extraction service (auto + custom modes)
- [x] **4.2** Test `/api/process` endpoint end-to-end
- [x] **4.3** Test `/api/re-extract` endpoint

### Phase 5: Documentation Updates

- [x] **5.1** Update `CLAUDE.md` _(completed 2025-12-16)_
- [x] **5.2** Update `planning/ARCHITECTURE.md` _(completed 2025-12-16)_
- [x] **5.3** Update `planning/TASKS.md` with migration section _(completed 2025-12-16)_

---

## Overview

This document contains actionable tasks to migrate from LangChain to Anthropic SDK and simplify the FastAPI backend to AI-only operations.

**Key References:**

- `planning/MIGRATION-PLAN.md` - Architecture overview and rationale
- `planning/ARCHITECTURE-UPDATE.md` - Claude Agent SDK code examples and patterns

---

## Phase 1: Dependencies & Configuration

### Task 1.1: Update Python Dependencies

**File:** `backend/requirements.txt`

**Current:**

```
openai==2.6.1
langchain-openai==1.0.1
```

**Target:**

```
anthropic>=0.40.0
```

**Action:**

```bash
cd backend
pip uninstall openai langchain-openai -y
pip install anthropic>=0.40.0
pip freeze > requirements.txt
```

**Verification:**

- [ ] `pip list | grep anthropic` shows version >=0.40.0
- [ ] `pip list | grep langchain` returns nothing

---

### Task 1.2: Update Environment Configuration

**File:** `backend/app/config.py`

**Changes:**

1. Remove `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`
2. Add `ANTHROPIC_API_KEY`

**Current:**

```python
class Settings(BaseSettings):
    # ...
    OPENROUTER_API_KEY: str
    OPENROUTER_MODEL: str = "anthropic/claude-3.5-sonnet"
```

**Target:**

```python
class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str

    # OCR
    MISTRAL_API_KEY: str

    # Extraction (Anthropic Direct)
    ANTHROPIC_API_KEY: str
    CLAUDE_MODEL: str = "claude-sonnet-4-20250514"

    # App
    APP_NAME: str = "Stackdocs MVP"
    APP_VERSION: str = "0.2.0"  # Bump version for migration
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: str = "http://localhost:3000"
```

---

### Task 1.3: Update Environment Files

**File:** `backend/.env`

**Remove:**

```
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=...
```

**Add:**

```
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-20250514
```

**File:** `backend/.env.example`

Update template to match.

---

## Phase 2: Rewrite Extraction Service

### Task 2.1: Replace LangChain Extractor with Anthropic SDK

**File:** `backend/app/services/extractor.py`

**Current implementation uses:**

- LangChain `ChatOpenAI` with OpenRouter
- `ChatPromptTemplate` for prompts
- `with_structured_output(method="function_calling")`

**New implementation uses:**

- Anthropic SDK `Anthropic` client
- Tool use for guaranteed structured output
- Direct API calls (no LangChain abstraction)

**Reference:** See `planning/ARCHITECTURE-UPDATE.md` lines 141-176 for Pydantic models and lines 366-495 for extraction implementation patterns.

**New `services/extractor.py`:**

```python
"""
Anthropic SDK extraction service for structured data extraction from documents.

Uses Claude's tool use feature for guaranteed structured outputs.
Replaces LangChain implementation for simpler, more direct integration.
"""

from typing import Any
from anthropic import Anthropic
from ..config import get_settings

settings = get_settings()

# Initialize Anthropic client
client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)

# Tool definition for structured extraction output
EXTRACTION_TOOL = {
    "name": "save_extracted_data",
    "description": "Save the extracted structured data from the document. Call this tool with the extracted fields and confidence scores.",
    "input_schema": {
        "type": "object",
        "properties": {
            "extracted_fields": {
                "type": "object",
                "description": "Dictionary of field names to extracted values. Use snake_case for field names.",
                "additionalProperties": True
            },
            "confidence_scores": {
                "type": "object",
                "description": "Dictionary of field names to confidence scores (0.0-1.0)",
                "additionalProperties": {
                    "type": "number",
                    "minimum": 0.0,
                    "maximum": 1.0
                }
            }
        },
        "required": ["extracted_fields", "confidence_scores"]
    }
}


async def extract_auto_mode(text: str) -> dict[str, Any]:
    """
    Extract all relevant fields automatically from document text.

    Uses Claude's tool use for guaranteed structured output.

    Args:
        text: Raw text from OCR extraction

    Returns:
        Dictionary with:
        - extracted_fields: Dict of field names to values
        - confidence_scores: Dict of field names to confidence (0.0-1.0)
    """
    response = client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=4096,
        tools=[EXTRACTION_TOOL],
        tool_choice={"type": "tool", "name": "save_extracted_data"},
        messages=[{
            "role": "user",
            "content": f"""Analyze this document and extract ALL relevant structured data.

Use clear, descriptive field names in snake_case (e.g., vendor_name, invoice_date, total_amount).
For each field, provide a confidence score between 0.0 and 1.0.

Guidelines:
- Extract dates in ISO 8601 format (YYYY-MM-DD)
- Extract monetary amounts as numbers (without currency symbols)
- Only extract data that is explicitly present in the document
- If a field value is unclear or missing, omit it rather than guessing
- Common fields to look for: vendor/company names, dates, amounts, IDs, addresses, line items

Document text:
{text}"""
        }]
    )

    # Extract tool use result from response
    for block in response.content:
        if block.type == "tool_use" and block.name == "save_extracted_data":
            return {
                "extracted_fields": block.input.get("extracted_fields", {}),
                "confidence_scores": block.input.get("confidence_scores", {})
            }

    # Fallback if no tool use (shouldn't happen with tool_choice)
    raise ValueError("No extraction result returned from Claude")


async def extract_custom_fields(text: str, custom_fields: list[str]) -> dict[str, Any]:
    """
    Extract only specified fields from document text.

    Args:
        text: Raw text from OCR extraction
        custom_fields: List of field names to extract

    Returns:
        Dictionary with:
        - extracted_fields: Dict of requested field names to values
        - confidence_scores: Dict of field names to confidence (0.0-1.0)
    """
    fields_str = ", ".join(custom_fields)

    response = client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=4096,
        tools=[EXTRACTION_TOOL],
        tool_choice={"type": "tool", "name": "save_extracted_data"},
        messages=[{
            "role": "user",
            "content": f"""Extract ONLY these specific fields from the document: {fields_str}

For each field, provide a confidence score between 0.0 and 1.0.

Guidelines:
- Extract dates in ISO 8601 format (YYYY-MM-DD)
- Extract monetary amounts as numbers (without currency symbols)
- If a requested field is not found, set its value to null with confidence 0.0
- Only extract data that is explicitly present in the document
- Do not invent or infer values that aren't clearly stated

Document text:
{text}"""
        }]
    )

    # Extract tool use result
    for block in response.content:
        if block.type == "tool_use" and block.name == "save_extracted_data":
            return {
                "extracted_fields": block.input.get("extracted_fields", {}),
                "confidence_scores": block.input.get("confidence_scores", {})
            }

    raise ValueError("No extraction result returned from Claude")
```

**Verification:**

- [ ] No LangChain imports remain
- [ ] Both `extract_auto_mode` and `extract_custom_fields` work
- [ ] Tool use returns structured output
- [ ] Error handling for edge cases

---

## Phase 3: Consolidate FastAPI Routes

### Task 3.1: Create New Process Router

**File:** `backend/app/routes/process.py` (NEW)

This consolidates upload + OCR + extraction into a single endpoint with background processing.

**Reference:** See `planning/ARCHITECTURE-UPDATE.md` lines 762-1044 for FastAPI endpoint patterns.

```python
"""
Document processing endpoints - AI operations only.

All data reading/writing for frontend goes through Supabase directly.
These endpoints only handle:
- POST /api/process - Full pipeline (upload + OCR + extract)
- POST /api/re-extract - New extraction from cached OCR
"""

import time
import logging
from typing import Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks

from ..services.storage import upload_document, create_signed_url
from ..services.ocr import extract_text_ocr
from ..services.extractor import extract_auto_mode, extract_custom_fields
from ..services.usage import check_usage_limit, increment_usage
from ..database import get_supabase_client
from ..config import get_settings

router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)


async def process_document_task(
    document_id: str,
    user_id: str,
    file_path: str,
    mode: str,
    custom_fields: list[str] | None = None
):
    """
    Background task: OCR → Extract → Save results.

    Updates document status to 'completed' or 'failed'.
    Frontend receives update via Supabase Realtime subscription.
    """
    supabase = get_supabase_client()

    try:
        # Step 1: OCR with Mistral
        logger.info(f"Starting OCR for document {document_id}")
        signed_url = await create_signed_url(file_path)
        ocr_result = await extract_text_ocr(signed_url)

        # Save OCR result (cache for re-extraction)
        supabase.table("ocr_results").upsert({
            "document_id": document_id,
            "user_id": user_id,
            "raw_text": ocr_result["text"],
            "page_count": ocr_result.get("page_count", 1),
            "model": ocr_result.get("model", "mistral-ocr-latest"),
            "processing_time_ms": ocr_result.get("processing_time_ms", 0),
            "usage_info": ocr_result.get("usage_info", {}),
            "layout_data": ocr_result.get("layout_data", {}),
        }).execute()
        logger.info(f"OCR complete for document {document_id}")

        # Step 2: Extract with Claude
        logger.info(f"Starting extraction for document {document_id}, mode={mode}")
        start_time = time.time()

        if mode == "custom" and custom_fields:
            result = await extract_custom_fields(ocr_result["text"], custom_fields)
        else:
            result = await extract_auto_mode(ocr_result["text"])

        processing_time_ms = int((time.time() - start_time) * 1000)

        # Step 3: Save extraction
        supabase.table("extractions").insert({
            "document_id": document_id,
            "user_id": user_id,
            "extracted_fields": result["extracted_fields"],
            "confidence_scores": result["confidence_scores"],
            "mode": mode,
            "custom_fields": custom_fields,
            "model": settings.CLAUDE_MODEL,
            "processing_time_ms": processing_time_ms
        }).execute()
        logger.info(f"Extraction saved for document {document_id}")

        # Step 4: Mark document complete
        supabase.table("documents").update({
            "status": "completed"
        }).eq("id", document_id).execute()

        logger.info(f"Processing complete for document {document_id}")

    except Exception as e:
        logger.error(f"Processing failed for document {document_id}: {e}")
        supabase.table("documents").update({
            "status": "failed"
        }).eq("id", document_id).execute()


@router.post("/process")
async def process_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    mode: str = Form(...),
    user_id: str = Form(...),
    custom_fields: str | None = Form(None),
) -> dict[str, Any]:
    """
    Upload and process document (full pipeline).

    Returns immediately with document_id.
    Processing happens in background.
    Frontend subscribes to Supabase Realtime for status updates.

    Args:
        file: Document file (PDF, JPG, PNG)
        mode: "auto" or "custom"
        user_id: User UUID
        custom_fields: Comma-separated field names (required if mode=custom)

    Returns:
        document_id, status, message
    """
    # Validate mode
    if mode not in ["auto", "custom"]:
        raise HTTPException(status_code=400, detail="Mode must be 'auto' or 'custom'")

    if mode == "custom" and not custom_fields:
        raise HTTPException(status_code=400, detail="custom_fields required for custom mode")

    # Check usage limit
    can_upload = await check_usage_limit(user_id)
    if not can_upload:
        raise HTTPException(
            status_code=403,
            detail="Upload limit reached. Please upgrade your plan."
        )

    # Upload file to Supabase Storage
    upload_result = await upload_document(user_id, file)

    # Create document record
    supabase = get_supabase_client()
    supabase.table("documents").insert({
        "id": upload_result["document_id"],
        "user_id": user_id,
        "filename": upload_result["filename"],
        "file_path": upload_result["file_path"],
        "file_size_bytes": upload_result["file_size_bytes"],
        "mime_type": upload_result["mime_type"],
        "mode": mode,
        "status": "processing",
    }).execute()

    # Increment usage counter
    await increment_usage(user_id)

    # Parse custom fields if provided
    fields_list = None
    if custom_fields:
        fields_list = [f.strip() for f in custom_fields.split(",") if f.strip()]

    # Queue background processing
    background_tasks.add_task(
        process_document_task,
        upload_result["document_id"],
        user_id,
        upload_result["file_path"],
        mode,
        fields_list
    )

    return {
        "document_id": upload_result["document_id"],
        "filename": upload_result["filename"],
        "status": "processing",
        "message": "Processing started. Subscribe to Supabase Realtime for updates."
    }


@router.post("/re-extract")
async def re_extract_document(
    document_id: str = Form(...),
    user_id: str = Form(...),
    mode: str = Form(...),
    custom_fields: str | None = Form(None),
) -> dict[str, Any]:
    """
    Re-extract from cached OCR (no new OCR API call).

    Useful when user wants to:
    - Switch from auto to custom mode
    - Try different custom fields
    - Get a fresh extraction

    Args:
        document_id: Document UUID
        user_id: User UUID
        mode: "auto" or "custom"
        custom_fields: Comma-separated field names (for custom mode)

    Returns:
        New extraction result
    """
    supabase = get_supabase_client()

    # Verify document exists and user owns it
    doc = supabase.table("documents").select("*").eq("id", document_id).eq("user_id", user_id).single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    # Fetch cached OCR
    ocr = supabase.table("ocr_results").select("raw_text").eq("document_id", document_id).single().execute()
    if not ocr.data:
        raise HTTPException(
            status_code=400,
            detail="No cached OCR found. Use /api/process to process the document first."
        )

    # Parse custom fields
    fields_list = None
    if custom_fields:
        fields_list = [f.strip() for f in custom_fields.split(",") if f.strip()]

    # Run extraction (no OCR - uses cache)
    start_time = time.time()

    if mode == "custom" and fields_list:
        result = await extract_custom_fields(ocr.data["raw_text"], fields_list)
    else:
        result = await extract_auto_mode(ocr.data["raw_text"])

    processing_time_ms = int((time.time() - start_time) * 1000)

    # Save new extraction
    extraction = supabase.table("extractions").insert({
        "document_id": document_id,
        "user_id": user_id,
        "extracted_fields": result["extracted_fields"],
        "confidence_scores": result["confidence_scores"],
        "mode": mode,
        "custom_fields": fields_list,
        "model": settings.CLAUDE_MODEL,
        "processing_time_ms": processing_time_ms
    }).execute()

    return {
        "extraction_id": extraction.data[0]["id"],
        "document_id": document_id,
        "mode": mode,
        "extracted_fields": result["extracted_fields"],
        "confidence_scores": result["confidence_scores"],
        "model": settings.CLAUDE_MODEL,
        "processing_time_ms": processing_time_ms,
        "field_count": len(result["extracted_fields"])
    }
```

---

### Task 3.2: Update Main App Router Registration

**File:** `backend/app/main.py`

**Changes:**

1. Remove old router imports (documents, ocr, extractions)
2. Import new process router
3. Update router registrations

**Current:**

```python
from .routes import documents, ocr, extractions

app.include_router(documents.router, prefix="/api", tags=["documents"])
app.include_router(ocr.router, prefix="/api", tags=["ocr"])
app.include_router(extractions.router, prefix="/api", tags=["extractions"])
```

**Target:**

```python
from .routes import process

# Health check stays
@app.get("/health", response_model=HealthResponse)
async def health_check():
    ...

# Only AI processing endpoints
app.include_router(process.router, prefix="/api", tags=["processing"])
```

---

### Task 3.3: Clean Up Old Route Files

**Action:** Delete or archive old route files that are no longer needed.

**Files to remove/archive:**

- `backend/app/routes/documents.py` - Merged into process.py
- `backend/app/routes/ocr.py` - Merged into process.py
- `backend/app/routes/extractions.py` - Merged into process.py (test endpoints removed)
- `backend/app/routes/usage.py` - Frontend uses Supabase direct

**Note:** Keep `backend/app/routes/__init__.py` but update imports.

---

## Phase 4: Testing & Validation

### Task 4.1: Test Extraction Service

**Test file:** Create `backend/tests/test_extractor.py`

```python
import pytest
from app.services.extractor import extract_auto_mode, extract_custom_fields

SAMPLE_INVOICE_TEXT = """
INVOICE #12345
Date: 2024-01-15

Bill To:
Acme Corporation
123 Business St
Sydney NSW 2000

Items:
- Widget A: $150.00
- Widget B: $250.00

Subtotal: $400.00
GST (10%): $40.00
Total: $440.00

Payment Due: 2024-02-15
"""

@pytest.mark.asyncio
async def test_auto_extraction():
    result = await extract_auto_mode(SAMPLE_INVOICE_TEXT)

    assert "extracted_fields" in result
    assert "confidence_scores" in result
    assert len(result["extracted_fields"]) > 0

    # Check some expected fields
    fields = result["extracted_fields"]
    assert "invoice_number" in fields or "invoice_id" in fields

@pytest.mark.asyncio
async def test_custom_extraction():
    custom_fields = ["vendor_name", "total_amount", "invoice_date"]
    result = await extract_custom_fields(SAMPLE_INVOICE_TEXT, custom_fields)

    assert "extracted_fields" in result
    assert "confidence_scores" in result
```

**Run tests:**

```bash
cd backend
pytest tests/test_extractor.py -v
```

---

### Task 4.2: Test Process Endpoint

**Manual testing via Swagger:**

1. Start server: `uvicorn app.main:app --reload`
2. Open http://localhost:8000/docs
3. Test `POST /api/process` with a PDF file
4. Verify document record created in Supabase
5. Verify status updates to 'completed'
6. Verify extraction saved

**Verify in Supabase:**

```sql
-- Check document status
SELECT id, filename, status, uploaded_at
FROM documents
ORDER BY uploaded_at DESC
LIMIT 5;

-- Check extraction results
SELECT e.id, e.document_id, e.mode, e.extracted_fields, e.processing_time_ms
FROM extractions e
ORDER BY e.created_at DESC
LIMIT 5;

-- Check OCR cache
SELECT id, document_id, page_count, processing_time_ms
FROM ocr_results
ORDER BY created_at DESC
LIMIT 5;
```

---

### Task 4.3: Test Re-extract Endpoint

**Test re-extraction flow:**

1. Use document from Task 4.2
2. Call `POST /api/re-extract` with mode="custom"
3. Verify new extraction created (different from first)
4. Verify OCR was NOT called again (check ocr_results - should be same record)

---

## Phase 5: Documentation Updates

### Task 5.1: Update CLAUDE.md

**File:** `CLAUDE.md`

Update the following sections:

1. **Tech Stack** - Remove LangChain, add Anthropic SDK
2. **Architecture** - Update to hybrid architecture diagram
3. **API Endpoints** - Document new `/api/process` and `/api/re-extract`
4. **Data Flow** - Update to show Supabase Realtime for frontend
5. **Environment Variables** - Update list

---

### Task 5.2: Update ARCHITECTURE.md

**File:** `planning/ARCHITECTURE.md`

Major updates:

1. Add hybrid architecture diagram
2. Document frontend direct Supabase access
3. Document Supabase Realtime usage
4. Update endpoint documentation
5. Remove LangChain references

---

### Task 5.3: Update TASKS.md

**File:** `planning/TASKS.md`

Add new section documenting migration completion:

```markdown
## Architecture Migration (December 2025)

### Migration Complete

- [x] Phase 1: Dependencies updated (LangChain → Anthropic SDK)
- [x] Phase 2: Extractor service rewritten
- [x] Phase 3: FastAPI routes consolidated
- [x] Phase 4: Testing validated
- [x] Phase 5: Documentation updated

### New Architecture

- Backend: 2 endpoints only (`/api/process`, `/api/re-extract`)
- Frontend: Direct Supabase access for all data operations
- Status updates: Supabase Realtime (no polling)
```

---

## Success Criteria

**Migration is successful when:**

1. ✅ Server starts without errors
2. ✅ `POST /api/process` uploads file, runs OCR, extracts, saves
3. ✅ Document status updates to 'completed'
4. ✅ `POST /api/re-extract` works with cached OCR
5. ✅ No LangChain code remains in codebase
6. ✅ Extraction quality matches or exceeds previous implementation

---

## Rollback Plan

If issues arise:

1. **Git revert** - All changes should be in a single branch
2. **Keep old files** - Archive rather than delete during migration
3. **Environment toggle** - Could add feature flag to switch between old/new

**Rollback command:**

```bash
git checkout main -- backend/app/services/extractor.py
git checkout main -- backend/app/routes/
git checkout main -- backend/requirements.txt
```

---

## Notes for Next Session

**Context for the implementing agent:**

1. **Current state**: Backend is 90% complete with LangChain + OpenRouter
2. **Working components**: Mistral OCR, Supabase Storage, file upload, usage tracking
3. **What changes**: LangChain → Anthropic SDK, multiple routes → 2 routes
4. **What stays**: Mistral OCR, Supabase, FastAPI framework, background tasks

**Key files to read first:**

- `backend/app/services/extractor.py` - Current LangChain implementation
- `backend/app/routes/documents.py` - Current upload endpoint
- `backend/app/routes/extractions.py` - Current test endpoints
- `planning/ARCHITECTURE-UPDATE.md` - Claude SDK patterns and examples

**Start with:**

1. Read existing extractor.py to understand current implementation
2. Update requirements.txt
3. Rewrite extractor.py with Anthropic SDK
4. Test extraction before touching routes
5. Then consolidate routes

---

**Compiled by**: Claude Code
**Last Updated**: 2025-12-16
**Ready for Implementation**: Yes
