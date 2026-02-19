# Mistral OCR 3 Upgrade + Document Upload Endpoint

**Created:** 2025-12-21
**Status:** Designed, ready to implement

---

## Overview

Upgrade from Mistral OCR 2 to OCR 3, restructure the API to separate upload/OCR from extraction, and store HTML table data for future document preview rendering.

**Goals:**
1. Better extraction accuracy (74% win rate over OCR 2, especially for tables/handwriting)
2. Cleaner API separation: upload+OCR is distinct from extraction
3. Store HTML tables for future frontend preview feature

**Not in scope:**
- Re-processing existing documents (leave as-is, project not live)
- Agent changes (agent continues using markdown only)
- New OCR 3 features (header/footer extraction, bounding boxes)
- Frontend preview implementation (Phase 2)

---

## API Changes

### New Endpoint

**`POST /api/document/upload`** - Upload file + run OCR (synchronous)

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | Document file (PDF, JPG, PNG) |
| `user_id` | string | User UUID |

**Response:**
```json
{
  "document_id": "uuid",
  "filename": "invoice.pdf",
  "status": "ocr_complete",
  "ocr_result": {
    "raw_text": "Invoice from Acme Corp...",
    "html_tables": ["<table>...</table>"],
    "page_count": 2,
    "processing_time_ms": 1850,
    "model": "mistral-ocr-2512"
  }
}
```

**Behavior:**
- Synchronous request (client waits ~2 seconds)
- Uploads file to Supabase Storage
- Runs OCR 3 with `table_format="html"`
- Saves to `documents` and `ocr_results` tables
- Returns full OCR result directly

### Deprecated Endpoints

| Endpoint | Replacement |
|----------|-------------|
| `POST /api/process` | `POST /api/document/upload` (OCR) + `POST /api/document/extract` (extraction) |
| `POST /api/re-extract` | `POST /api/document/extract` |

### Document Status Values

| Status | Meaning |
|--------|---------|
| `processing` | Upload/OCR in progress |
| `ocr_complete` | OCR done, ready for extraction |
| `failed` | Something went wrong |

Note: Extraction status is tracked separately in the `extractions` table, not on the document.

---

## Phase 1: Backend Changes (Now)

### Database Migration

Add one column to `ocr_results`:

```sql
-- Migration: 006_add_html_tables.sql
ALTER TABLE ocr_results
ADD COLUMN html_tables JSONB;

COMMENT ON COLUMN ocr_results.html_tables IS 'HTML table strings from OCR 3 for frontend rendering';
```

Nullable so existing rows remain valid.

### OCR Service Changes

**File:** `backend/app/services/ocr.py`

1. Update model: `mistral-ocr-latest` → `mistral-ocr-2512`
2. Add `table_format="html"` parameter
3. Extract `tables` array from response pages
4. Update `OCRResult` TypedDict to include `html_tables: list[str] | None`

**API call change:**

```python
# Before
client.ocr.process(
    model="mistral-ocr-latest",
    document={"type": "document_url", "document_url": url},
    include_image_base64=False
)

# After
client.ocr.process(
    model="mistral-ocr-2512",
    document={"type": "document_url", "document_url": url},
    table_format="html",
    include_image_base64=False
)
```

**Response handling:**

OCR 3 returns:
- `markdown` field: Document content with placeholders like `[tbl-0.html](tbl-0.html)`
- `tables` array: List of HTML table strings (only when `table_format="html"`)

Store markdown in `raw_text`, HTML tables in new `html_tables` column.

### Route Changes

**File:** `backend/app/routes/document.py` (new file)

Create new route file with `POST /api/document/upload`:
- Reuse upload logic from `process.py` lines 141-157
- Reuse OCR logic from `process.py` lines 45-61
- Make synchronous (no BackgroundTasks)
- Add `html_tables` to OCR result saving
- Return full OCR result in response

**File:** `backend/app/routes/process.py`

Delete this file (endpoints deprecated).

**File:** `backend/app/main.py`

- Remove `process` router import
- Add `document` router import

### Files to Modify

| File | Change |
|------|--------|
| `backend/migrations/006_add_html_tables.sql` | Add column |
| `backend/app/services/ocr.py` | Update model, params, response handling |
| `backend/app/routes/document.py` | New file with upload endpoint |
| `backend/app/routes/process.py` | Delete |
| `backend/app/main.py` | Update router imports |
| `docs/SCHEMA.md` | Document new column + status values |
| `docs/ARCHITECTURE.md` | Update endpoint documentation |

---

## Phase 2: Frontend Document Preview (Later)

### OCR Text Tab Enhancement

The preview panel's "OCR Text" tab will need:

1. **Toggle control** - Switch between "Raw" and "Rendered" views
2. **Raw view** - Display `raw_text` as plain markdown
3. **Rendered view** - Replace table placeholders with HTML, render formatted

### Data Fetching

```typescript
const { data } = await supabase
  .from('ocr_results')
  .select('raw_text, html_tables')
  .eq('document_id', documentId)
  .single()
```

### Rendering Logic

```typescript
function renderOcrContent(rawText: string, htmlTables: string[] | null) {
  if (!htmlTables) return rawText; // Old documents

  let rendered = rawText;
  htmlTables.forEach((tableHtml, i) => {
    // Replace placeholder with actual HTML table
    // Note: Placeholder format should be verified during Phase 1 testing
    rendered = rendered.replace(`[tbl-${i}.html](tbl-${i}.html)`, tableHtml);
  });
  return rendered;
}
```

> **Note:** The placeholder format `[tbl-{i}.html](tbl-{i}.html)` should be verified during Phase 1 testing (Task 8). The actual format may differ slightly.

---

## Technical Notes

### OCR 3 Output Format

OCR 3 outputs markdown with embedded placeholders, not full HTML. The `tables` array contains table objects with content:

```json
{
  "pages": [{
    "index": 0,
    "markdown": "Invoice\n\n[tbl-0.html](tbl-0.html)\n\nTotal: $1,320.00",
    "tables": [
      {
        "id": "tbl-0",
        "format": "html",
        "content": "<table><tr><th>Product</th>...</table>"
      }
    ]
  }]
}
```

We extract just the `content` field from each table object and store as `html_tables: ["<table>...</table>"]`.

### Why Synchronous?

OCR typically takes 1-3 seconds. Synchronous request is simpler than background tasks + polling/realtime. FastAPI's async handles ~40 concurrent requests without blocking. Can switch to background tasks later if needed for scale.

### Agent Impact

The extraction agent reads `raw_text` (markdown) via `read_ocr` tool. No agent changes needed - HTML tables are for frontend preview only. If complex table extraction issues arise later, we can enhance the agent to use `html_tables`.

### Migration Strategy

Existing documents keep their OCR 2 output (`html_tables` = null). New uploads get OCR 3 with HTML tables. No reprocessing needed since project isn't live.

### Cost

OCR 3 pricing: $2/1,000 pages (same tier as OCR 2). Batch API available at $1/1,000 pages.

---

## Success Criteria

- [ ] `POST /api/document/upload` works and returns OCR result
- [ ] New uploads use `mistral-ocr-2512`
- [ ] HTML tables stored in `html_tables` column
- [ ] Document status set to `ocr_complete` after OCR
- [ ] Old endpoints removed (`/api/process`, `/api/re-extract`)
- [ ] Existing documents unaffected
- [ ] Extraction accuracy improves for table-heavy documents

---

## References

- [Mistral OCR 3 Announcement](https://mistral.ai/news/mistral-ocr-3)
- [Mistral OCR API Docs](https://docs.mistral.ai/capabilities/document_ai/basic_ocr)
