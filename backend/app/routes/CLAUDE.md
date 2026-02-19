# Routes

**Purpose:** FastAPI route modules defining all API endpoints for document processing, AI extraction, and service testing.

## Files

| File | Description |
|------|-------------|
| `__init__.py` | Package marker |
| `document.py` | Document upload and OCR processing endpoints |
| `agent.py` | AI extraction endpoints with SSE streaming |
| `test.py` | Service connectivity tests (Claude, Mistral) |

## Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/document/upload` | POST | JWT | Upload file (instant), queue OCR + metadata as background tasks |
| `/api/document/retry-ocr` | POST | JWT | Retry OCR on failed documents (queues background task) |
| `/api/document/metadata` | POST | JWT | Generate AI metadata (SSE stream) |
| `/api/agent/extract` | POST | JWT | Run extraction agent (SSE stream) |
| `/api/agent/correct` | POST | JWT | Resume session with correction instruction |
| `/api/agent/health` | GET | None | Agent health check |
| `/api/test/claude` | GET | None | Test Claude SDK connectivity |
| `/api/test/mistral` | GET | None | Test Mistral OCR connectivity |

## Key Patterns

- **SSE Streaming**: Agent endpoints return `StreamingResponse` with `text/event-stream` media type. Events are JSON objects: `{"text": "..."}`, `{"tool": "...", "input": {...}}`, `{"complete": true}`, `{"error": "..."}`

- **Dependency Injection**: Auth via `user_id: str = Depends(get_current_user)` extracts user from Clerk JWT

- **Form Data**: Agent/document endpoints use `Form(...)` for parameters, not JSON body

- **Status Flow**: Documents go `uploading` -> `processing` -> `ocr_complete` or `failed`. Extractions have `in_progress` -> `complete`

- **Background Task Chain**: `upload_and_ocr()` queues `_run_ocr_background()` which directly awaits `_run_metadata_background()` on success. Frontend tracks via Supabase Realtime. Note: Background tasks cannot spawn other background tasks (no `BackgroundTasks` instance available in background context).

- **Usage Limits**: `document.py` checks `check_usage_limit()` before upload, calls `increment_usage()` after success

## Authentication

- **Protected endpoints**: `document.py` and `agent.py` require Clerk JWT via `get_current_user` dependency
- **Public endpoints**: `test.py` and `/api/agent/health` have no auth (debugging/health checks)
- **Ownership checks**: Queries filter by `user_id` to ensure users only access their own data
