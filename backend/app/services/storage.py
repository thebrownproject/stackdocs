"""
Supabase Storage service for document file management.

Handles upload, download, signed URLs, and deletion of document files.
"""

import logging
from typing import TypedDict
from uuid import uuid4

from fastapi import UploadFile, HTTPException

from ..database import get_supabase_client

logger = logging.getLogger(__name__)

# Supported document types
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
}

MAX_FILE_SIZE_MB = 10
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


class UploadResult(TypedDict):
    """Result from document upload."""
    document_id: str
    file_path: str
    filename: str
    file_size_bytes: int
    mime_type: str


def _validate_file(file: UploadFile, content: bytes) -> str:
    """
    Validate uploaded file and return mime type.

    Raises:
        HTTPException: If validation fails
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    mime_type = file.content_type or "application/octet-stream"
    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {mime_type}. Allowed: PDF, JPEG, PNG, WebP"
        )

    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE_MB}MB"
        )

    return mime_type


async def upload_document(user_id: str, file: UploadFile) -> UploadResult:
    """
    Upload document to Supabase Storage.

    Args:
        user_id: User UUID for path namespacing
        file: FastAPI UploadFile object

    Returns:
        UploadResult with document_id, file_path, and metadata

    Raises:
        HTTPException: If validation or upload fails
    """
    content = await file.read()
    mime_type = _validate_file(file, content)

    document_id = str(uuid4())
    file_path = f"{user_id}/{document_id}_{file.filename}"

    try:
        supabase = get_supabase_client()
        supabase.storage.from_("documents").upload(
            path=file_path,
            file=content,
            file_options={"content-type": mime_type, "cache-control": "3600"},
        )

        logger.info(f"Uploaded document: {file_path} ({len(content)} bytes)")

        return {
            "document_id": document_id,
            "file_path": file_path,
            "filename": file.filename,
            "file_size_bytes": len(content),
            "mime_type": mime_type,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed for {file.filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}") from e


async def create_signed_url(file_path: str, expires_in: int = 3600) -> str:
    """
    Create time-limited signed URL for document access.

    Args:
        file_path: Path to file in storage bucket
        expires_in: URL validity in seconds (default: 1 hour)

    Returns:
        Signed URL string

    Raises:
        HTTPException: If URL creation fails
    """
    try:
        supabase = get_supabase_client()
        response = supabase.storage.from_("documents").create_signed_url(
            file_path, expires_in
        )
        return response["signedUrl"]

    except Exception as e:
        logger.error(f"Signed URL creation failed for {file_path}: {e}")
        raise HTTPException(status_code=500, detail=f"Signed URL creation failed: {e}") from e


async def download_document(file_path: str) -> bytes:
    """
    Download document from Supabase Storage.

    Args:
        file_path: Path to file in storage bucket

    Returns:
        File content as bytes

    Raises:
        HTTPException: If download fails
    """
    try:
        supabase = get_supabase_client()
        return supabase.storage.from_("documents").download(file_path)

    except Exception as e:
        logger.error(f"Download failed for {file_path}: {e}")
        raise HTTPException(status_code=500, detail=f"Download failed: {e}") from e


async def delete_document(file_path: str) -> bool:
    """
    Delete document from Supabase Storage.

    Args:
        file_path: Path to file in storage bucket

    Returns:
        True if deletion succeeded

    Raises:
        HTTPException: If deletion fails
    """
    try:
        supabase = get_supabase_client()
        supabase.storage.from_("documents").remove([file_path])
        logger.info(f"Deleted document: {file_path}")
        return True

    except Exception as e:
        logger.error(f"Delete failed for {file_path}: {e}")
        raise HTTPException(status_code=500, detail=f"Delete failed: {e}") from e
