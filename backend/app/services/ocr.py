"""
Mistral OCR service for extracting text from documents.

Uses Mistral's OCR API to process document images and PDFs.
"""

import logging
import time
from asyncio import to_thread
from typing import Any, TypedDict

from mistralai import Mistral

from ..config import get_settings

logger = logging.getLogger(__name__)

# Lazy client initialization
_client: Mistral | None = None


def _get_client() -> Mistral:
    """Get or create Mistral client (lazy initialization)."""
    global _client
    if _client is None:
        settings = get_settings()
        _client = Mistral(api_key=settings.MISTRAL_API_KEY)
    return _client


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
    html_tables: list[str] | None  # HTML tables from OCR 3


def _extract_page_text(page: Any) -> str:
    """Extract text content from a page, preferring markdown."""
    return getattr(page, 'markdown', None) or getattr(page, 'text', '') or ''


def _extract_image_annotations(page: Any) -> list[str]:
    """Extract text annotations from images in a page."""
    annotations = []
    if images := getattr(page, 'images', None):
        for img in images:
            if annotation := getattr(img, 'image_annotation', None):
                annotations.append(f"[Image content: {annotation}]")
    return annotations


def _extract_page_layout(page: Any) -> dict[str, Any]:
    """Extract layout data (images, dimensions) from a page."""
    layout: dict[str, Any] = {}

    # Extract image data if present
    if images := getattr(page, 'images', None):
        layout['images'] = [
            {
                'id': getattr(img, 'id', None),
                'top_left_x': getattr(img, 'top_left_x', None),
                'top_left_y': getattr(img, 'top_left_y', None),
                'bottom_right_x': getattr(img, 'bottom_right_x', None),
                'bottom_right_y': getattr(img, 'bottom_right_y', None),
                'image_base64': getattr(img, 'image_base64', None),
                'image_annotation': getattr(img, 'image_annotation', None),
            }
            for img in images
        ]

    # Extract dimensions if present
    if dims := getattr(page, 'dimensions', None):
        layout['dimensions'] = {
            'dpi': getattr(dims, 'dpi', None),
            'height': getattr(dims, 'height', None),
            'width': getattr(dims, 'width', None),
        }

    # Extract page index
    if (index := getattr(page, 'index', None)) is not None:
        layout['index'] = index

    return layout


def _extract_usage_info(response: Any) -> dict[str, Any]:
    """Extract usage information from OCR response."""
    if usage := getattr(response, 'usage_info', None):
        return {
            'pages_processed': getattr(usage, 'pages_processed', None),
            'doc_size_bytes': getattr(usage, 'doc_size_bytes', None),
        }
    return {}


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


async def extract_text_ocr(document_url: str) -> OCRResult:
    """
    Extract text from document using Mistral OCR.

    Args:
        document_url: Signed URL to document file (from Supabase Storage)

    Returns:
        OCRResult with extracted text, metadata, and optional layout data

    Raises:
        ValueError: If OCR processing fails or returns no text
    """
    start_time = time.time()

    try:
        client = _get_client()
        logger.info("Starting Mistral OCR processing")

        # Call Mistral OCR API (sync client, run in thread)
        def _call_ocr():
            return client.ocr.process(
                model="mistral-ocr-latest",
                document={"type": "document_url", "document_url": document_url},
                table_format="html",
                include_image_base64=False
            )

        response = await to_thread(_call_ocr)
        processing_time_ms = int((time.time() - start_time) * 1000)

        # Validate response
        if not response.pages:
            raise ValueError("OCR returned no pages")

        # Extract text, image annotations, and layout from all pages
        page_texts = [_extract_page_text(page) for page in response.pages]
        image_annotations = [ann for page in response.pages for ann in _extract_image_annotations(page)]
        layout_pages = [layout for page in response.pages if (layout := _extract_page_layout(page))]

        # Combine page text with image annotations
        extracted_text = "\n\n".join(filter(None, page_texts))
        if image_annotations:
            extracted_text += "\n\n--- Image Content ---\n" + "\n".join(image_annotations)
        if not extracted_text:
            raise ValueError("OCR returned empty text from all pages")

        # Build result
        page_count = len(response.pages)
        model = getattr(response, 'model', 'mistral-ocr-latest')

        logger.info(
            f"OCR complete: {page_count} pages, {len(extracted_text)} chars, {processing_time_ms}ms"
        )

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
            "html_tables": _extract_html_tables(response.pages),
        }

    except Exception as e:
        processing_time_ms = int((time.time() - start_time) * 1000)
        error_msg = f"OCR processing failed: {e}"
        logger.error(error_msg)
        raise ValueError(error_msg) from e
