# Service Test Endpoints Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `/api/test/claude` and `/api/test/mistral` endpoints to verify API connectivity via Swagger UI.

**Architecture:** New `test.py` router with two GET endpoints. Each makes a minimal API call (Claude: simple query via Agent SDK, Mistral: list models) and returns standardized response with timing. Always returns 200 with status field for Swagger-friendly debugging.

**Tech Stack:** FastAPI, Claude Agent SDK, Mistral SDK, Pydantic

---

## Task 1: Add Response Model

**Files:**
- Modify: `backend/app/models.py`

**Step 1: Add ServiceTestResponse model to models.py**

Add after `HealthResponse` (line 59):

```python
class ServiceTestResponse(BaseModel):
    """Response from service test endpoints"""
    status: Literal["ok", "error"]
    service: str
    model: str | None = None
    response_time_ms: int | None = None
    message: str | None = None
    error_type: str | None = None
    timestamp: datetime
```

**Step 2: Verify no syntax errors**

Run: `cd /Users/fraserbrown/stackdocs/backend && python -c "from app.models import ServiceTestResponse; print('OK')"`

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/models.py
git commit -m "feat: add ServiceTestResponse model for test endpoints"
```

---

## Task 2: Create Test Router with Claude Endpoint

**Files:**
- Create: `backend/app/routes/test.py`

**Step 1: Create test.py with Claude test endpoint**

```python
"""
Service test endpoints for debugging API connectivity.

Endpoints:
- GET /api/test/claude - Test Claude Agent SDK connectivity
- GET /api/test/mistral - Test Mistral API connectivity
"""

import time
import logging
from datetime import datetime, timezone

from fastapi import APIRouter
from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage

from ..config import get_settings
from ..models import ServiceTestResponse

router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)


@router.get("/claude", response_model=ServiceTestResponse)
async def test_claude():
    """
    Test Claude Agent SDK connectivity with a minimal ping.

    Sends a simple query to verify the API key and SDK work.
    Cost: ~$0.0001 per call.
    """
    start_time = time.perf_counter()

    try:
        options = ClaudeAgentOptions(
            allowed_tools=[],  # No tools needed for ping
            max_turns=1,
        )

        model_used = None
        async for message in query(prompt="Say 'ok'", options=options):
            if isinstance(message, ResultMessage):
                model_used = getattr(message, 'model', None)

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        return ServiceTestResponse(
            status="ok",
            service="claude",
            model=model_used or settings.CLAUDE_MODEL,
            response_time_ms=elapsed_ms,
            timestamp=datetime.now(timezone.utc)
        )

    except Exception as e:
        logger.error(f"Claude test error: {e}")
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        # Categorize error type
        error_str = str(e).lower()
        if "auth" in error_str or "api key" in error_str or "401" in error_str:
            error_type = "authentication_error"
            message = "Invalid API key"
        elif "rate" in error_str or "429" in error_str:
            error_type = "rate_limit_error"
            message = "Rate limited - try again later"
        elif "connect" in error_str or "network" in error_str:
            error_type = "network_error"
            message = "Could not connect to service"
        elif "timeout" in error_str:
            error_type = "timeout_error"
            message = "Request timed out"
        else:
            error_type = "unknown_error"
            message = str(e)

        return ServiceTestResponse(
            status="error",
            service="claude",
            message=message,
            error_type=error_type,
            response_time_ms=elapsed_ms,
            timestamp=datetime.now(timezone.utc)
        )
```

**Step 2: Verify no syntax errors**

Run: `cd /Users/fraserbrown/stackdocs/backend && python -c "from app.routes.test import router; print('OK')"`

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/routes/test.py
git commit -m "feat: add /api/test/claude endpoint using Agent SDK"
```

---

## Task 3: Add Mistral Test Endpoint

**Files:**
- Modify: `backend/app/routes/test.py`

**Step 1: Add Mistral imports and endpoint**

Add to imports section (after existing imports):

```python
from asyncio import to_thread
from mistralai import Mistral
from mistralai.models import SDKError
```

Add after the `test_claude` function:

```python
@router.get("/mistral", response_model=ServiceTestResponse)
async def test_mistral():
    """
    Test Mistral API connectivity by listing available models.

    Cost: Free (no billable operation).
    """
    start_time = time.perf_counter()

    try:
        client = Mistral(api_key=settings.MISTRAL_API_KEY)

        # List models is a sync operation, run in thread
        response = await to_thread(client.models.list)

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        # Get first model name for display
        model_name = response.data[0].id if response.data else "unknown"

        return ServiceTestResponse(
            status="ok",
            service="mistral",
            model=model_name,
            response_time_ms=elapsed_ms,
            timestamp=datetime.now(timezone.utc)
        )

    except SDKError as e:
        logger.warning(f"Mistral SDK error: {e}")
        error_type = "unknown_error"
        message = str(e)

        # Parse common error types from message
        if "401" in message or "unauthorized" in message.lower():
            error_type = "authentication_error"
            message = "Invalid API key"
        elif "429" in message or "rate" in message.lower():
            error_type = "rate_limit_error"
            message = "Rate limited - try again later"

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        return ServiceTestResponse(
            status="error",
            service="mistral",
            message=message,
            error_type=error_type,
            response_time_ms=elapsed_ms,
            timestamp=datetime.now(timezone.utc)
        )

    except Exception as e:
        logger.error(f"Mistral unexpected error: {e}")
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        # Check for connection errors
        if "connect" in str(e).lower():
            return ServiceTestResponse(
                status="error",
                service="mistral",
                message="Could not connect to service",
                error_type="network_error",
                response_time_ms=elapsed_ms,
                timestamp=datetime.now(timezone.utc)
            )

        return ServiceTestResponse(
            status="error",
            service="mistral",
            message=str(e),
            error_type="unknown_error",
            response_time_ms=elapsed_ms,
            timestamp=datetime.now(timezone.utc)
        )
```

**Step 2: Verify no syntax errors**

Run: `cd /Users/fraserbrown/stackdocs/backend && python -c "from app.routes.test import router; print('OK')"`

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/routes/test.py
git commit -m "feat: add /api/test/mistral endpoint for API connectivity check"
```

---

## Task 4: Register Router in Main App

**Files:**
- Modify: `backend/app/main.py`

**Step 1: Import test router**

Change line 7 from:

```python
from .routes import process, agent
```

To:

```python
from .routes import process, agent, test
```

**Step 2: Add router registration**

Add after line 54 (after agent router):

```python
app.include_router(test.router, prefix="/api/test", tags=["test"])
```

**Step 3: Verify app starts**

Run: `cd /Users/fraserbrown/stackdocs/backend && python -c "from app.main import app; print('Routes:', [r.path for r in app.routes])"`

Expected: Should include `/api/test/claude` and `/api/test/mistral` in output

**Step 4: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: register test router at /api/test"
```

---

## Task 5: Manual Verification

**Step 1: Start the development server**

Run: `cd /Users/fraserbrown/stackdocs/backend && uvicorn app.main:app --reload --port 8000`

**Step 2: Test Claude endpoint**

Run (in new terminal): `curl http://localhost:8000/api/test/claude | python -m json.tool`

Expected: JSON with `"status": "ok"`, `"service": "claude"`, model name, `response_time_ms`, and `timestamp`

**Step 3: Test Mistral endpoint**

Run: `curl http://localhost:8000/api/test/mistral | python -m json.tool`

Expected: JSON with `"status": "ok"`, `"service": "mistral"`, model name, `response_time_ms`, and `timestamp`

**Step 4: Verify Swagger UI**

Open: `http://localhost:8000/docs`

Expected: New "test" section with both endpoints, expandable and executable

**Step 5: Stop server and final commit**

```bash
git add -A
git commit -m "docs: verify test endpoints working"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add response model | `models.py` |
| 2 | Create test router with Claude endpoint | `routes/test.py` (new) |
| 3 | Add Mistral endpoint | `routes/test.py` |
| 4 | Register router | `main.py` |
| 5 | Manual verification | - |

**Total:** 5 tasks, ~15 minutes
