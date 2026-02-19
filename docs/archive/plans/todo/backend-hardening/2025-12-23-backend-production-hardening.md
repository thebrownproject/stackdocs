# Backend Production Hardening Implementation Plan [ARCHIVED]

> **MIGRATED TO BEADS:** All tasks have been migrated to Beads issue tracker as epic `stackdocs-e7z`.
> Use `bd show stackdocs-e7z` to view the epic and its child tasks.
> This file is kept for historical reference and detailed implementation notes.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden the FastAPI backend for production deployment by addressing security vulnerabilities, adding rate limiting, improving error handling, and implementing production best practices.

**Architecture:** Add security middleware stack (headers, CORS restrictions), rate limiting with slowapi, file content validation with python-magic, structured logging, and global exception handling. All changes are additive - no breaking changes to existing API contracts.

**Tech Stack:** FastAPI, slowapi (rate limiting), python-magic (file validation), Starlette middleware

---

## Summary of Issues (from Code Review)

### Critical (Must Fix)
1. No rate limiting - API abuse/cost attack vector
2. No file content validation - trusts client headers only
3. Unsafe CORS - `allow_methods=["*"]`, `allow_headers=["*"]`
4. No security headers - missing HSTS, X-Content-Type-Options, etc.

### Important (Should Fix)
5. No structured logging
6. No global exception handler
7. Error messages leak internal details
8. No request ID tracing
9. Missing Pydantic validation on env vars

### Verified Safe
- Secrets NOT in git (gitignore protected from start)
- DEBUG=False is default in config.py (line 29)

---

## Phase 1: Security Middleware (Critical)

### Task 1: Add Security Headers Middleware

**Files:**
- Create: `backend/app/middleware/__init__.py`
- Create: `backend/app/middleware/security.py`
- Modify: `backend/app/main.py`

**Step 1: Create middleware package**

```bash
mkdir -p backend/app/middleware
```

**Step 2: Create security headers middleware**

Create `backend/app/middleware/security.py`:

```python
"""Security middleware for production hardening."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Add security headers to all responses.

    Headers added:
    - Strict-Transport-Security: Enforce HTTPS
    - X-Content-Type-Options: Prevent MIME sniffing
    - X-Frame-Options: Prevent clickjacking
    - X-XSS-Protection: Legacy XSS protection
    - Referrer-Policy: Control referrer information
    - Permissions-Policy: Restrict browser features
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # HSTS - enforce HTTPS for 1 year, include subdomains
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Legacy XSS protection (modern browsers use CSP instead)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Control referrer information
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Restrict browser features (adjust as needed)
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=()"
        )

        return response
```

**Step 3: Create middleware package init**

Create `backend/app/middleware/__init__.py`:

```python
"""Middleware package for FastAPI application."""

from .security import SecurityHeadersMiddleware

__all__ = ["SecurityHeadersMiddleware"]
```

**Step 4: Add middleware to main.py**

Modify `backend/app/main.py` to add the security middleware after CORS:

```python
# Add after CORS middleware
from .middleware import SecurityHeadersMiddleware

# Security headers (after CORS, before routes)
app.add_middleware(SecurityHeadersMiddleware)
```

**Step 5: Test security headers**

```bash
cd backend && python -c "from app.main import app; print('Middleware loaded')"
curl -I http://localhost:8000/health | grep -E "(Strict-Transport|X-Content-Type|X-Frame)"
```

Expected: Headers present in response

**Step 6: Commit**

```bash
git add backend/app/middleware/
git add backend/app/main.py
git commit -m "feat(security): add security headers middleware

Add SecurityHeadersMiddleware with:
- Strict-Transport-Security (HSTS)
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Referrer-Policy
- Permissions-Policy"
```

---

### Task 2: Restrict CORS Configuration

**Files:**
- Modify: `backend/app/main.py:19-25`

**Step 1: Update CORS middleware with explicit methods and headers**

Replace the CORS middleware configuration in `backend/app/main.py`:

```python
# Add CORS middleware with restricted methods and headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID", "X-RateLimit-Remaining", "X-RateLimit-Limit"],
    max_age=3600,  # Cache preflight for 1 hour
)
```

**Step 2: Test CORS still works**

```bash
# Start backend
cd backend && uvicorn app.main:app --reload &

# Test preflight request
curl -X OPTIONS http://localhost:8000/api/document/upload \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization, Content-Type" \
  -I

# Should see Access-Control-Allow-* headers
```

**Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "fix(security): restrict CORS to explicit methods and headers

- Allow only GET, POST, PUT, DELETE, OPTIONS methods
- Allow only Authorization, Content-Type, X-Request-ID headers
- Expose X-Request-ID, X-RateLimit-* headers for client use
- Add 1 hour preflight cache"
```

---

## Phase 2: Rate Limiting (Critical)

### Task 3: Install Rate Limiting Dependencies

**Files:**
- Modify: `backend/requirements.txt`

**Step 1: Add slowapi to requirements**

Add to `backend/requirements.txt`:

```
# Rate Limiting
slowapi==0.1.9
```

**Step 2: Install dependencies**

```bash
cd backend && pip install -r requirements.txt
```

**Step 3: Verify installation**

```bash
python -c "from slowapi import Limiter; print('slowapi installed')"
```

**Step 4: Commit**

```bash
git add backend/requirements.txt
git commit -m "deps: add slowapi for rate limiting"
```

---

### Task 4: Create Rate Limiter Configuration

**Files:**
- Create: `backend/app/middleware/rate_limit.py`
- Modify: `backend/app/middleware/__init__.py`

**Step 1: Create rate limiter module**

Create `backend/app/middleware/rate_limit.py`:

```python
"""Rate limiting configuration using slowapi."""

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi import Request
from fastapi.responses import JSONResponse


def get_user_or_ip(request: Request) -> str:
    """
    Get rate limit key from authenticated user ID or IP address.

    Uses user_id from request state (set by auth) if available,
    otherwise falls back to client IP address.
    """
    # Check if user is authenticated (set by auth dependency)
    if hasattr(request.state, "user_id"):
        return f"user:{request.state.user_id}"

    # Fall back to IP address
    return get_remote_address(request)


# Create limiter instance with default limits
# Using in-memory storage for simplicity (use Redis for multi-instance)
limiter = Limiter(
    key_func=get_user_or_ip,
    default_limits=["100/minute"],  # Default for all endpoints
    storage_uri="memory://",  # In-memory for single instance
    # For production with multiple instances, use Redis:
    # storage_uri="redis://localhost:6379"
)


async def rate_limit_exceeded_handler(
    request: Request,
    exc: RateLimitExceeded
) -> JSONResponse:
    """Custom handler for rate limit exceeded errors."""
    return JSONResponse(
        status_code=429,
        content={
            "error": {
                "code": "RATE_LIMIT_EXCEEDED",
                "message": f"Rate limit exceeded: {exc.detail}",
                "retry_after": getattr(exc, "retry_after", 60),
            }
        },
        headers={
            "Retry-After": str(getattr(exc, "retry_after", 60)),
            "X-RateLimit-Limit": str(limiter.get_limits(request)),
        }
    )
```

**Step 2: Update middleware __init__.py**

Update `backend/app/middleware/__init__.py`:

```python
"""Middleware package for FastAPI application."""

from .security import SecurityHeadersMiddleware
from .rate_limit import limiter, rate_limit_exceeded_handler

__all__ = [
    "SecurityHeadersMiddleware",
    "limiter",
    "rate_limit_exceeded_handler",
]
```

**Step 3: Commit**

```bash
git add backend/app/middleware/
git commit -m "feat(security): add rate limiter configuration

- Create slowapi limiter with user/IP-based keys
- Default 100 requests/minute limit
- Custom 429 error handler with retry-after"
```

---

### Task 5: Apply Rate Limiting to Routes

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/app/routes/document.py`
- Modify: `backend/app/routes/agent.py`

**Step 1: Register rate limiter in main.py**

Add to `backend/app/main.py` after app creation:

```python
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from .middleware import limiter, rate_limit_exceeded_handler

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
```

**Step 2: Add rate limits to document routes**

Modify `backend/app/routes/document.py`:

```python
from ..middleware import limiter
from fastapi import Request

@router.post("/document/upload")
@limiter.limit("10/minute")  # Expensive operation - strict limit
async def upload_and_ocr(
    request: Request,  # Required for rate limiter
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
) -> dict[str, Any]:
    # ... existing code
```

```python
@router.post("/document/retry-ocr")
@limiter.limit("5/minute")  # Retry should be rare
async def retry_ocr(
    request: Request,
    document_id: str = Form(...),
    user_id: str = Depends(get_current_user),
) -> dict[str, Any]:
    # ... existing code
```

**Step 3: Add rate limits to agent routes**

Modify `backend/app/routes/agent.py` (add to extract and correct endpoints):

```python
from ..middleware import limiter
from fastapi import Request

@router.post("/extract")
@limiter.limit("20/minute")  # AI extraction - moderate limit
async def extract_document(
    request: Request,
    # ... existing params
):
    # ... existing code

@router.post("/correct")
@limiter.limit("30/minute")  # Corrections - slightly higher
async def correct_extraction(
    request: Request,
    # ... existing params
):
    # ... existing code
```

**Step 4: Test rate limiting**

```bash
# Start backend
cd backend && uvicorn app.main:app --reload &

# Hit endpoint multiple times rapidly
for i in {1..15}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/health
done

# After default limit, should see 429
```

**Step 5: Commit**

```bash
git add backend/app/main.py backend/app/routes/
git commit -m "feat(security): apply rate limiting to API routes

Rate limits:
- document/upload: 10/minute (expensive OCR)
- document/retry-ocr: 5/minute (should be rare)
- agent/extract: 20/minute (AI extraction)
- agent/correct: 30/minute (corrections)
- default: 100/minute (all other endpoints)"
```

---

## Phase 3: File Content Validation (Critical)

### Task 6: Install python-magic

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/Dockerfile`

**Step 1: Add python-magic to requirements**

Add to `backend/requirements.txt`:

```
# File validation
python-magic==0.4.27
```

**Step 2: Add libmagic to Dockerfile**

Modify `backend/Dockerfile` to install libmagic in the runtime stage:

```dockerfile
# In the runtime stage, add:
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*
```

**Step 3: Install locally**

```bash
# macOS
brew install libmagic

# Then install Python package
cd backend && pip install python-magic
```

**Step 4: Verify installation**

```bash
python -c "import magic; print(magic.Magic(mime=True).from_buffer(b'%PDF-1.4'))"
# Should print: application/pdf
```

**Step 5: Commit**

```bash
git add backend/requirements.txt backend/Dockerfile
git commit -m "deps: add python-magic for file content validation"
```

---

### Task 7: Implement File Content Validation

**Files:**
- Modify: `backend/app/services/storage.py:38-61`

**Step 1: Update _validate_file function**

Replace the `_validate_file` function in `backend/app/services/storage.py`:

```python
import magic

def _validate_file(file: UploadFile, content: bytes) -> str:
    """
    Validate uploaded file by checking actual content, not just headers.

    Uses python-magic to inspect file signature (magic bytes) to prevent
    attackers from uploading malicious files with fake extensions.

    Args:
        file: FastAPI UploadFile object
        content: File content as bytes

    Returns:
        Detected MIME type

    Raises:
        HTTPException: If validation fails
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE_MB}MB"
        )

    # Detect actual MIME type from file content (not headers)
    mime_detector = magic.Magic(mime=True)
    detected_type = mime_detector.from_buffer(content)

    if detected_type not in ALLOWED_MIME_TYPES:
        # Log the mismatch for security monitoring
        declared_type = file.content_type or "unknown"
        logger.warning(
            f"File validation failed: declared={declared_type}, "
            f"detected={detected_type}, filename={file.filename}"
        )
        raise HTTPException(
            status_code=415,
            detail=f"Invalid file content. Detected type: {detected_type}. "
                   f"Allowed: PDF, JPEG, PNG, WebP"
        )

    # Optional: warn if declared type doesn't match detected type
    declared_type = file.content_type or "application/octet-stream"
    if declared_type != detected_type:
        logger.info(
            f"MIME type mismatch (allowed): declared={declared_type}, "
            f"detected={detected_type}, filename={file.filename}"
        )

    return detected_type
```

**Step 2: Test file validation**

```bash
# Create a test file with wrong extension
echo "not a pdf" > /tmp/fake.pdf

# Try to upload (should fail with 415)
curl -X POST http://localhost:8000/api/document/upload \
  -H "Authorization: Bearer TEST" \
  -F "file=@/tmp/fake.pdf"

# Should get 415 Unsupported Media Type
```

**Step 3: Commit**

```bash
git add backend/app/services/storage.py
git commit -m "fix(security): validate file content with python-magic

- Detect actual MIME type from file bytes, not headers
- Prevent malicious file uploads with fake extensions
- Log MIME type mismatches for security monitoring"
```

---

## Phase 4: Error Handling (Important)

### Task 8: Create Global Exception Handler

**Files:**
- Create: `backend/app/middleware/exceptions.py`
- Modify: `backend/app/middleware/__init__.py`
- Modify: `backend/app/main.py`

**Step 1: Create exception handler module**

Create `backend/app/middleware/exceptions.py`:

```python
"""Global exception handling for production safety."""

import logging
import traceback
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from ..config import get_settings

logger = logging.getLogger(__name__)


async def global_exception_handler(
    request: Request,
    exc: Exception
) -> JSONResponse:
    """
    Handle all unhandled exceptions.

    - Logs full error details for debugging
    - Returns safe error message to client (no stack traces)
    - Includes request ID for correlation
    """
    settings = get_settings()
    request_id = getattr(request.state, "request_id", "unknown")

    # Log the full error for debugging
    logger.error(
        f"Unhandled exception [request_id={request_id}]: {exc}",
        exc_info=True,
        extra={
            "request_id": request_id,
            "path": str(request.url),
            "method": request.method,
        }
    )

    # In development, include error details
    if settings.ENVIRONMENT == "development":
        detail = str(exc)
    else:
        # In production, hide internal details
        detail = "An unexpected error occurred. Please try again."

    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": detail,
                "request_id": request_id,
            }
        }
    )


async def http_exception_handler(
    request: Request,
    exc: HTTPException
) -> JSONResponse:
    """
    Handle HTTPException with consistent format.

    Ensures all HTTP errors follow the same response structure.
    """
    request_id = getattr(request.state, "request_id", "unknown")

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail,
                "request_id": request_id,
            }
        }
    )


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError
) -> JSONResponse:
    """
    Handle Pydantic validation errors with clear messages.
    """
    request_id = getattr(request.state, "request_id", "unknown")

    # Extract validation error details
    errors = []
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"])
        errors.append(f"{field}: {error['msg']}")

    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": errors,
                "request_id": request_id,
            }
        }
    )
```

**Step 2: Update middleware __init__.py**

Add to `backend/app/middleware/__init__.py`:

```python
from .exceptions import (
    global_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)

__all__ = [
    "SecurityHeadersMiddleware",
    "limiter",
    "rate_limit_exceeded_handler",
    "global_exception_handler",
    "http_exception_handler",
    "validation_exception_handler",
]
```

**Step 3: Register exception handlers in main.py**

Add to `backend/app/main.py`:

```python
from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from .middleware import (
    global_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)

# Exception handlers
app.add_exception_handler(Exception, global_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
```

**Step 4: Test exception handling**

```bash
# Test validation error
curl -X POST http://localhost:8000/api/document/upload \
  -H "Content-Type: application/json" \
  -d '{}'

# Should get structured 422 error with details
```

**Step 5: Commit**

```bash
git add backend/app/middleware/
git add backend/app/main.py
git commit -m "feat(errors): add global exception handlers

- Global handler catches unhandled exceptions safely
- HTTP exceptions return consistent error format
- Validation errors include field-specific details
- Production mode hides internal error details"
```

---

### Task 9: Add Request ID Middleware

**Files:**
- Create: `backend/app/middleware/request_id.py`
- Modify: `backend/app/middleware/__init__.py`
- Modify: `backend/app/main.py`

**Step 1: Create request ID middleware**

Create `backend/app/middleware/request_id.py`:

```python
"""Request ID middleware for request tracing."""

import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Add unique request ID to each request for tracing.

    - Uses X-Request-ID header if provided by client/load balancer
    - Generates UUID if not provided
    - Adds request ID to response headers
    - Stores in request.state for use in logging
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Get existing request ID or generate new one
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))

        # Store in request state for access in route handlers
        request.state.request_id = request_id

        # Process request
        response = await call_next(request)

        # Add to response headers for client correlation
        response.headers["X-Request-ID"] = request_id

        return response
```

**Step 2: Update middleware __init__.py**

Add to `backend/app/middleware/__init__.py`:

```python
from .request_id import RequestIDMiddleware

__all__ = [
    # ... existing exports
    "RequestIDMiddleware",
]
```

**Step 3: Add middleware to main.py**

Add to `backend/app/main.py` (should be first middleware, outermost layer):

```python
from .middleware import RequestIDMiddleware

# Request ID tracing (first middleware - outermost)
app.add_middleware(RequestIDMiddleware)
```

**Step 4: Test request ID**

```bash
curl -I http://localhost:8000/health | grep X-Request-ID
# Should see: X-Request-ID: <uuid>

# Test with custom ID
curl -I http://localhost:8000/health -H "X-Request-ID: my-custom-id" | grep X-Request-ID
# Should see: X-Request-ID: my-custom-id
```

**Step 5: Commit**

```bash
git add backend/app/middleware/
git add backend/app/main.py
git commit -m "feat(observability): add request ID tracing middleware

- Generate UUID for each request
- Respect X-Request-ID from client/load balancer
- Include in response headers and error messages
- Store in request.state for logging"
```

---

### Task 10: Sanitize Error Messages in Services

**Files:**
- Modify: `backend/app/services/storage.py`
- Modify: `backend/app/routes/document.py`

**Step 1: Update storage.py error handling**

In `backend/app/services/storage.py`, update the exception handlers to not leak details:

```python
except Exception as e:
    logger.error(f"Upload failed for {file.filename}: {e}")
    raise HTTPException(
        status_code=500,
        detail="File upload failed. Please try again."
    ) from e
```

```python
except Exception as e:
    logger.error(f"Signed URL creation failed for {file_path}: {e}")
    raise HTTPException(
        status_code=500,
        detail="Failed to generate document URL. Please try again."
    ) from e
```

```python
except Exception as e:
    logger.error(f"Download failed for {file_path}: {e}")
    raise HTTPException(
        status_code=500,
        detail="File download failed. Please try again."
    ) from e
```

```python
except Exception as e:
    logger.error(f"Delete failed for {file_path}: {e}")
    raise HTTPException(
        status_code=500,
        detail="File deletion failed. Please try again."
    ) from e
```

**Step 2: Update document.py error handling**

In `backend/app/routes/document.py`, update the exception handler:

```python
except Exception as e:
    logger.error(f"OCR failed for document {document_id}: {e}")
    supabase.table("documents").update({
        "status": "failed"
    }).eq("id", document_id).execute()
    raise HTTPException(
        status_code=500,
        detail="Document processing failed. Please try again or contact support."
    )
```

**Step 3: Commit**

```bash
git add backend/app/services/storage.py
git add backend/app/routes/document.py
git commit -m "fix(security): sanitize error messages to hide internals

- Replace f-string errors with generic user-friendly messages
- Keep detailed logging for debugging
- Prevent information disclosure in production"
```

---

## Phase 5: Logging & Config Improvements (Important)

### Task 11: Add Structured Logging Configuration

**Files:**
- Create: `backend/app/logging_config.py`
- Modify: `backend/app/main.py`

**Step 1: Create logging configuration**

Create `backend/app/logging_config.py`:

```python
"""Structured logging configuration for production."""

import logging
import json
import sys
from datetime import datetime, timezone
from typing import Any

from .config import get_settings


class JSONFormatter(logging.Formatter):
    """
    Format log records as JSON for structured logging.

    Enables log aggregation and searching in production
    (e.g., with DataDog, CloudWatch, or ELK stack).
    """

    def format(self, record: logging.LogRecord) -> str:
        log_data: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Add extra fields if present
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        if hasattr(record, "user_id"):
            log_data["user_id"] = record.user_id
        if hasattr(record, "path"):
            log_data["path"] = record.path
        if hasattr(record, "method"):
            log_data["method"] = record.method

        return json.dumps(log_data)


class DevelopmentFormatter(logging.Formatter):
    """Human-readable formatter for local development."""

    def __init__(self):
        super().__init__(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%H:%M:%S"
        )


def setup_logging() -> None:
    """
    Configure logging based on environment.

    - Development: Human-readable format to console
    - Production: JSON format for log aggregation
    """
    settings = get_settings()

    # Determine log level
    log_level = logging.DEBUG if settings.DEBUG else logging.INFO

    # Create handler
    handler = logging.StreamHandler(sys.stdout)

    # Use JSON formatter in production, readable format in development
    if settings.ENVIRONMENT == "production":
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(DevelopmentFormatter())

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.handlers = [handler]

    # Reduce noise from third-party libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
```

**Step 2: Initialize logging in main.py**

Add at the top of `backend/app/main.py` (before app creation):

```python
from .logging_config import setup_logging

# Initialize structured logging
setup_logging()
```

**Step 3: Test logging**

```bash
cd backend && ENVIRONMENT=development uvicorn app.main:app --reload
# Should see readable logs

cd backend && ENVIRONMENT=production uvicorn app.main:app
# Should see JSON logs
```

**Step 4: Commit**

```bash
git add backend/app/logging_config.py
git add backend/app/main.py
git commit -m "feat(observability): add structured logging configuration

- JSON format in production for log aggregation
- Human-readable format in development
- Include request_id, user_id in log context
- Reduce noise from third-party libraries"
```

---

### Task 12: Enhance Pydantic Settings Validation

**Files:**
- Modify: `backend/app/config.py`

**Step 1: Add field validation to Settings**

Update `backend/app/config.py`:

```python
"""Application configuration using environment variables"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator, HttpUrl
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Supabase Configuration
    SUPABASE_URL: str = Field(..., min_length=10)
    SUPABASE_KEY: str = Field(..., min_length=20)  # Service role key

    # Anthropic API Configuration (for extraction)
    ANTHROPIC_API_KEY: str = Field(..., min_length=10)
    CLAUDE_MODEL: str = "claude-haiku-4-5"

    # Mistral API Configuration (for OCR)
    MISTRAL_API_KEY: str = Field(..., min_length=10)

    # Clerk Configuration (for auth)
    CLERK_SECRET_KEY: str = Field(..., min_length=10)
    CLERK_AUTHORIZED_PARTIES: str = "https://www.stackdocs.io"

    # Application Configuration
    APP_NAME: str = "Stackdocs MVP"
    APP_VERSION: str = "0.2.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # CORS Configuration
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    @field_validator("CLAUDE_MODEL")
    @classmethod
    def validate_claude_model(cls, v: str) -> str:
        """Validate Claude model is a known model."""
        allowed = [
            "claude-haiku-4-5",
            "claude-sonnet-4-20250514",
            "claude-opus-4-20250514",
        ]
        if v not in allowed:
            raise ValueError(f"Invalid CLAUDE_MODEL. Allowed: {allowed}")
        return v

    @field_validator("ENVIRONMENT")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        """Validate environment is a known value."""
        allowed = ["development", "staging", "production"]
        if v not in allowed:
            raise ValueError(f"Invalid ENVIRONMENT. Allowed: {allowed}")
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
```

**Step 2: Test validation**

```bash
# Test with invalid model (should fail)
CLAUDE_MODEL=invalid python -c "from app.config import get_settings; get_settings()"
# Should raise ValidationError

# Test with valid config
python -c "from app.config import get_settings; print(get_settings().ENVIRONMENT)"
```

**Step 3: Commit**

```bash
git add backend/app/config.py
git commit -m "feat(config): add Pydantic validation for environment variables

- Validate minimum lengths for API keys
- Validate CLAUDE_MODEL against allowed models
- Validate ENVIRONMENT against known values
- Fail fast on startup if config is invalid"
```

---

## Phase 6: Health Check Enhancement (Suggestion)

### Task 13: Enhance Health Check Endpoint

**Files:**
- Modify: `backend/app/main.py:29-37`
- Modify: `backend/app/models.py`

**Step 1: Update health check response model**

Add to `backend/app/models.py`:

```python
class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    app_name: str
    version: str
    environment: str
    database: str = "unknown"
    checks: dict[str, str] = {}
```

**Step 2: Update health check endpoint**

Replace the health check in `backend/app/main.py`:

```python
import logging
from .database import get_supabase_client

logger = logging.getLogger(__name__)

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    API health check endpoint with dependency checks.

    Returns:
        - status: "healthy" if all checks pass, "degraded" otherwise
        - database: connection status
    """
    checks = {}

    # Check database connectivity
    try:
        supabase = get_supabase_client()
        supabase.table("users").select("id").limit(1).execute()
        checks["database"] = "healthy"
    except Exception as e:
        logger.warning(f"Health check - database unhealthy: {e}")
        checks["database"] = "unhealthy"

    # Determine overall status
    all_healthy = all(v == "healthy" for v in checks.values())
    status = "healthy" if all_healthy else "degraded"

    return {
        "status": status,
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "database": checks.get("database", "unknown"),
        "checks": checks,
    }
```

**Step 3: Test enhanced health check**

```bash
curl http://localhost:8000/health | jq
# Should show database status
```

**Step 4: Commit**

```bash
git add backend/app/main.py backend/app/models.py
git commit -m "feat(health): enhance health check with database connectivity

- Check Supabase database connectivity
- Return 'degraded' status if checks fail
- Include individual check results"
```

---

## Phase 7: Final Verification

### Task 14: Update main.py with Complete Middleware Stack

**Files:**
- Modify: `backend/app/main.py`

**Step 1: Ensure correct middleware order**

The final `backend/app/main.py` should have middleware in this order (last added = outermost):

```python
"""FastAPI application entry point"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .config import get_settings
from .models import HealthResponse
from .routes import document, agent, test
from .logging_config import setup_logging
from .middleware import (
    SecurityHeadersMiddleware,
    RequestIDMiddleware,
    limiter,
    rate_limit_exceeded_handler,
    global_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)

# Initialize structured logging
setup_logging()

# Initialize settings
settings = get_settings()

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION
)

# --- Exception Handlers ---
app.add_exception_handler(Exception, global_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# --- Middleware Stack ---
# Order matters: last added = outermost (first to process request)

# Rate limiting (needs request.state from other middleware)
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# Security headers
app.add_middleware(SecurityHeadersMiddleware)

# CORS (after security headers)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID", "X-RateLimit-Remaining", "X-RateLimit-Limit"],
    max_age=3600,
)

# Request ID tracing (outermost - first to run)
app.add_middleware(RequestIDMiddleware)

# ... rest of file (health check, routes, etc.)
```

**Step 2: Full integration test**

```bash
cd backend

# Start the server
uvicorn app.main:app --reload &
sleep 3

# Test all middleware working together
echo "=== Testing middleware stack ==="

# 1. Security headers
echo "\n1. Security Headers:"
curl -s -I http://localhost:8000/health | grep -E "(Strict-Transport|X-Content-Type|X-Frame|X-Request-ID)"

# 2. Rate limiting (hit 5 times fast)
echo "\n2. Rate Limiting:"
for i in {1..5}; do
  echo "Request $i: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health)"
done

# 3. Health check with DB status
echo "\n3. Enhanced Health Check:"
curl -s http://localhost:8000/health | python -m json.tool

# 4. Error handling (invalid request)
echo "\n4. Error Handling:"
curl -s -X POST http://localhost:8000/api/document/upload | python -m json.tool

echo "\n=== All tests complete ==="

# Stop the server
pkill -f "uvicorn app.main:app"
```

**Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "refactor(main): organize middleware stack with correct order

Middleware order (outermost first):
1. RequestIDMiddleware - adds tracing ID
2. CORSMiddleware - handles CORS
3. SecurityHeadersMiddleware - adds security headers
4. SlowAPIMiddleware - rate limiting

All exception handlers registered for consistent error responses."
```

---

### Task 15: Update Dockerfile for Graceful Shutdown

**Files:**
- Modify: `backend/Dockerfile`

**Step 1: Add graceful shutdown timeout**

Update the CMD in `backend/Dockerfile`:

```dockerfile
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--timeout-graceful-shutdown", "30"]
```

**Step 2: Commit**

```bash
git add backend/Dockerfile
git commit -m "fix(docker): add graceful shutdown timeout

Allow 30 seconds for in-flight requests to complete during deploys"
```

---

### Task 16: Create Production Checklist Documentation

**Files:**
- Create: `backend/PRODUCTION.md`

**Step 1: Create production checklist**

Create `backend/PRODUCTION.md`:

```markdown
# Backend Production Checklist

## Security

- [x] Security headers middleware (HSTS, X-Content-Type-Options, etc.)
- [x] CORS restricted to explicit methods and headers
- [x] Rate limiting on all endpoints (slowapi)
- [x] File content validation with python-magic
- [x] Error messages sanitized (no internal details leaked)
- [x] Secrets in environment variables (not in code/git)

## Observability

- [x] Structured JSON logging in production
- [x] Request ID tracing (X-Request-ID header)
- [x] Enhanced health check with database status
- [x] Global exception handler with logging

## Configuration

- [x] Pydantic validation on all environment variables
- [x] DEBUG=False enforced in production
- [x] Environment-specific settings (dev/staging/prod)

## Deployment

- [x] Graceful shutdown timeout (30s)
- [x] Non-root Docker user
- [x] Multi-stage Docker build
- [ ] Redis for rate limiting (if multi-instance)
- [ ] Log aggregation (DataDog/CloudWatch/ELK)
- [ ] APM/metrics (Prometheus/DataDog)

## Rate Limits

| Endpoint | Limit | Reason |
|----------|-------|--------|
| `/api/document/upload` | 10/min | Expensive OCR |
| `/api/document/retry-ocr` | 5/min | Should be rare |
| `/api/agent/extract` | 20/min | AI extraction |
| `/api/agent/correct` | 30/min | Corrections |
| Default | 100/min | All other endpoints |

## Environment Variables

Required in production:
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `ANTHROPIC_API_KEY`
- `MISTRAL_API_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_AUTHORIZED_PARTIES`
- `ALLOWED_ORIGINS`
- `ENVIRONMENT=production`
- `DEBUG=False`
```

**Step 2: Commit**

```bash
git add backend/PRODUCTION.md
git commit -m "docs: add production checklist and configuration reference"
```

---

## Summary

### Files Created
- `backend/app/middleware/__init__.py`
- `backend/app/middleware/security.py`
- `backend/app/middleware/rate_limit.py`
- `backend/app/middleware/request_id.py`
- `backend/app/middleware/exceptions.py`
- `backend/app/logging_config.py`
- `backend/PRODUCTION.md`

### Files Modified
- `backend/requirements.txt` (slowapi, python-magic)
- `backend/Dockerfile` (libmagic, graceful shutdown)
- `backend/app/main.py` (middleware stack, exception handlers)
- `backend/app/config.py` (Pydantic validation)
- `backend/app/services/storage.py` (file validation, error messages)
- `backend/app/routes/document.py` (rate limiting, error messages)
- `backend/app/routes/agent.py` (rate limiting)
- `backend/app/models.py` (enhanced HealthResponse)

### Commits (16 total)
1. Security headers middleware
2. Restrict CORS configuration
3. Add slowapi dependency
4. Rate limiter configuration
5. Apply rate limiting to routes
6. Add python-magic dependency
7. File content validation
8. Global exception handlers
9. Request ID middleware
10. Sanitize error messages
11. Structured logging
12. Pydantic settings validation
13. Enhanced health check
14. Organize middleware stack
15. Graceful shutdown timeout
16. Production documentation
