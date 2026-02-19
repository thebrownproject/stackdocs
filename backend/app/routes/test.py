"""
Service test endpoints for debugging API connectivity.

Endpoints:
- GET /api/test/claude - Test Claude Agent SDK connectivity
- GET /api/test/mistral - Test Mistral API connectivity
"""

import time
import logging
from asyncio import to_thread
from datetime import datetime, timezone

from fastapi import APIRouter
from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage
from mistralai import Mistral
from mistralai.models import SDKError

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


@router.get("/mistral", response_model=ServiceTestResponse)
async def test_mistral():
    """
    Test Mistral OCR API connectivity with a minimal test image.

    Cost: ~$0.002 per call (1 page).
    """
    start_time = time.perf_counter()

    try:
        client = Mistral(api_key=settings.MISTRAL_API_KEY)

        # Minimal 1x1 white PNG for testing OCR connectivity
        # This is the smallest valid PNG that OCR will accept
        test_image_base64 = (
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk"
            "+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )

        def _call_ocr():
            return client.ocr.process(
                model="mistral-ocr-latest",
                document={
                    "type": "image_url",
                    "image_url": f"data:image/png;base64,{test_image_base64}"
                }
            )

        response = await to_thread(_call_ocr)
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        # Get model from response
        model_name = getattr(response, 'model', 'mistral-ocr-latest')

        return ServiceTestResponse(
            status="ok",
            service="mistral-ocr",
            model=model_name,
            response_time_ms=elapsed_ms,
            timestamp=datetime.now(timezone.utc)
        )

    except SDKError as e:
        logger.warning(f"Mistral OCR SDK error: {e}")
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
            service="mistral-ocr",
            message=message,
            error_type=error_type,
            response_time_ms=elapsed_ms,
            timestamp=datetime.now(timezone.utc)
        )

    except Exception as e:
        logger.error(f"Mistral OCR unexpected error: {e}")
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        # Check for connection errors
        if "connect" in str(e).lower():
            return ServiceTestResponse(
                status="error",
                service="mistral-ocr",
                message="Could not connect to service",
                error_type="network_error",
                response_time_ms=elapsed_ms,
                timestamp=datetime.now(timezone.utc)
            )

        return ServiceTestResponse(
            status="error",
            service="mistral-ocr",
            message=str(e),
            error_type="unknown_error",
            response_time_ms=elapsed_ms,
            timestamp=datetime.now(timezone.utc)
        )
