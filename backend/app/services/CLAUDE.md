# Services

**Purpose:** Business logic services for document storage, OCR processing, and usage tracking.

## Files

| File | Description |
|------|-------------|
| `__init__.py` | Package marker |
| `storage.py` | Supabase Storage operations (upload, download, signed URLs, delete) |
| `ocr.py` | Mistral OCR integration for text extraction from documents |
| `usage.py` | Monthly usage limit tracking and quota management |

## Key Patterns

- **Async functions**: All public service functions are `async def` for non-blocking operation
- **Lazy client init**: Mistral client initialized on first use (`_get_client()`)
- **Thread offload**: Sync Mistral SDK calls wrapped with `asyncio.to_thread()` to avoid blocking
- **TypedDict returns**: Structured return types (`UploadResult`, `OCRResult`, `UsageStats`)
- **HTTPException errors**: Services raise FastAPI exceptions directly for route handlers

## Dependencies

| Service | External Dependencies |
|---------|----------------------|
| `storage.py` | Supabase Storage (`documents` bucket) |
| `ocr.py` | Mistral API (`mistral-ocr-latest` model) |
| `usage.py` | Supabase Database (`users` table) |

## Usage

Called from route handlers in `app/routes/`:

```python
# document.py - upload flow
from ..services.storage import upload_document
from ..services.ocr import extract_text_ocr
from ..services.usage import check_usage_limit, increment_usage

# Check limit before upload
if not await check_usage_limit(user_id):
    raise HTTPException(status_code=429, detail="Usage limit exceeded")

# Upload to storage
result = await upload_document(user_id, file)

# Get signed URL and run OCR
url = await create_signed_url(result["file_path"])
ocr_result = await extract_text_ocr(url)

# Increment usage after success
await increment_usage(user_id)
```

## Constants

| Constant | Value | Location |
|----------|-------|----------|
| `ALLOWED_MIME_TYPES` | PDF, JPEG, PNG, WebP | `storage.py` |
| `MAX_FILE_SIZE_MB` | 10 | `storage.py` |
