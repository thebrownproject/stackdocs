# Service Test Endpoints Design

**Date:** 2025-12-21
**Status:** Ready for implementation

## Overview

Add debug endpoints to manually verify Claude and Mistral API connectivity via Swagger UI (`api.stackdocs.io/docs`).

## Use Case

Manual debugging - hit the endpoint, see if the service responds. Not for continuous monitoring.

## Endpoints

### `GET /api/test/claude`

Tests Anthropic API connectivity with a minimal ping.

**Implementation:**
```python
response = client.messages.create(
    model=settings.CLAUDE_MODEL,  # claude-haiku-4-5
    max_tokens=1,
    messages=[{"role": "user", "content": "Hi"}]
)
```

Cost: ~$0.00001 per call (25 input tokens + 1 output token)

### `GET /api/test/mistral`

Tests Mistral API connectivity by listing available models.

**Implementation:**
```python
response = client.models.list()
```

Cost: Free (no billable operation)

## Response Format

**Success:**
```json
{
  "status": "ok",
  "service": "claude",
  "model": "claude-haiku-4-5",
  "response_time_ms": 342,
  "timestamp": "2025-12-21T10:30:00Z"
}
```

**Error:**
```json
{
  "status": "error",
  "service": "claude",
  "message": "Invalid API key",
  "error_type": "authentication_error",
  "timestamp": "2025-12-21T10:30:00Z"
}
```

## Error Types

| Error Type | Cause |
|------------|-------|
| `authentication_error` | Invalid/expired API key |
| `rate_limit_error` | Too many requests |
| `network_error` | Can't reach API |
| `timeout_error` | Request took >10 seconds |
| `unknown_error` | Unexpected response |

## Design Decisions

- **Always return 200** - Easier to read in Swagger than HTTP error pages
- **10 second timeout** - Generous for a ping, but won't hang forever
- **No retries** - For debugging, show failures immediately
- **Separate endpoints** - Easy to isolate which service is broken

## File Structure

**New file:** `backend/app/routes/test.py`

**Response model:**
```python
class ServiceTestResponse(BaseModel):
    status: Literal["ok", "error"]
    service: str
    model: Optional[str] = None
    response_time_ms: Optional[int] = None
    message: Optional[str] = None
    error_type: Optional[str] = None
    timestamp: datetime
```

**Integration in `main.py`:**
```python
from .routes import process, agent, test
app.include_router(test.router, prefix="/api/test", tags=["test"])
```

## Future Extensibility

Later additions (not in scope now):
- `GET /api/test/agent/extract` - Realistic agent test with sample document
- `GET /api/test/supabase` - Database connectivity check
