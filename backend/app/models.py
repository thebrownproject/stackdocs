"""Pydantic models for request/response validation"""

from pydantic import BaseModel
from typing import Literal
from datetime import datetime
from uuid import UUID

# Type alias for extracted field values
FieldValue = str | int | float | bool | None


# Document Models
class DocumentUploadResponse(BaseModel):
    """Response after uploading a document"""
    document_id: UUID
    filename: str
    status: Literal["processing", "completed", "failed"]
    message: str


class DocumentListItem(BaseModel):
    """Document item in list response"""
    id: UUID
    filename: str
    file_size_bytes: int
    mime_type: str
    mode: Literal["auto", "custom"]
    status: Literal["processing", "completed", "failed"]
    uploaded_at: datetime


# Extraction Models
class ExtractionResponse(BaseModel):
    """Response containing extraction results"""
    extraction_id: UUID
    document_id: UUID
    extracted_fields: dict[str, FieldValue]
    confidence_scores: dict[str, float] | None = None
    mode: Literal["auto", "custom"]
    created_at: datetime


# Usage Models
class UsageResponse(BaseModel):
    """User's current usage statistics"""
    documents_processed_this_month: int
    documents_limit: int
    subscription_tier: str
    usage_reset_date: datetime


# Health Check
class HealthResponse(BaseModel):
    """API health check response"""
    status: str
    app_name: str
    version: str
    environment: str


class ServiceTestResponse(BaseModel):
    """Response from service test endpoints"""
    status: Literal["ok", "error"]
    service: str
    model: str | None = None
    response_time_ms: int | None = None
    message: str | None = None
    error_type: str | None = None
    timestamp: datetime
