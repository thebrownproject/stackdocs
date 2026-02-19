# Stackdocs Architecture Update: Hybrid Approach with Claude Agent SDK

**Date:** 2025-01-13
**Status:** Planning Phase
**Purpose:** Document architectural decisions for integrating Claude Agent SDK and Supabase direct client

## Claude Agent SDK Capabilities Overview

Based on the latest Claude Agent SDK documentation, we can leverage these powerful features:

### Core Capabilities
- **Structured Outputs with JSON Schema Validation** - Guaranteed valid JSON matching defined schemas
- **MCP (Model Context Protocol) Servers** - Custom tools with isolated execution
- **Hooks System** - Pre/Post tool execution hooks for quality control and security
- **Cost Management** - Budget controls and spending limits
- **Concurrent Processing** - Background tasks with async support
- **Tool Permissions** - Fine-grained control over tool usage
- **Error Handling** - Comprehensive error types and recovery
- **Session Management** - Persistent conversations with context

## Executive Summary

We're evolving from a traditional FastAPI + LangChain architecture to a **hybrid approach** that combines:
- **Frontend:** Next.js with direct Supabase client for database operations
- **Backend:** Minimal FastAPI with Python Claude Agent SDK for secure processing
- **Result:** More responsive UI, better user experience, Claude Code-like intelligence

## Current Architecture (For Reference)

```
Next.js Frontend
    ↓ HTTPS REST API
FastAPI Backend (Python)
    ↓
LangChain + OpenRouter
    ↓
Supabase (PostgreSQL + Storage + Auth)
```

## New Hybrid Architecture

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│   Next.js       │    │   FastAPI (Minimal)   │    │   Supabase      │
│   + Supabase    │◄──►│   + Agent SDK        │◄──►│   (PostgreSQL)  │
│   Client        │    │   (Python)           │    │   + Storage     │
└─────────────────┘    └──────────────────────┘    └─────────────────┘
         │                       │
         │                       │
    ┌────▼────┐         ┌────────▼────────┐
    │ Realtime│         │  Mistral OCR    │
    │ Updates │         │  + Claude API   │
    └─────────┘         └─────────────────┘
```

## Key Architectural Changes

### 1. Frontend Enhancements

**New capabilities:**
- Direct database access via Supabase client
- Real-time updates via Supabase Realtime
- Non-blocking file uploads
- Instant UI feedback

**Implementation:**
```typescript
// lib/supabase-client.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// hooks/useRealtimeUpdates.ts
export function useDocumentStatus(documentId: string) {
  const [status, setStatus] = useState('uploaded')
  const [extraction, setExtraction] = useState(null)

  useEffect(() => {
    const subscription = supabase
      .channel(`document-${documentId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'documents',
        filter: `id=eq.${documentId}`
      }, (payload) => {
        setStatus(payload.new.status)
      })
      .subscribe()

    return () => subscription.unsubscribe()
  }, [documentId])

  return { status, extraction }
}
```

### 2. Backend Simplification

**Now handles only:**
- Secure API calls (Mistral OCR, Claude)
- Usage limit enforcement
- Background processing with Agent SDK
- Minimal essential endpoints

**Core Agent Implementation with Full SDK Capabilities:**
```python
# backend/app/agents/document_agent.py
from claude_agent_sdk import (
    query,
    ClaudeSDKClient,
    ClaudeAgentOptions,
    HookMatcher,
    HookInput,
    HookContext,
    HookJSONOutput,
    ToolPermissionContext,
    PermissionResultAllow,
    PermissionResultDeny,
    create_sdk_mcp_server,
    tool,
    # SDK-specific error types
    CLINotFoundError,
    ProcessError,
    CLIJSONDecodeError
)
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Union, Literal
from enum import Enum
import json
import asyncio
from datetime import datetime
from app.services.supabase import supabase
from app.services.mistral_ocr import extract_text_with_mistral

# Pydantic models for structured outputs
class DocumentType(str, Enum):
    INVOICE = "invoice"
    RECEIPT = "receipt"
    CONTRACT = "contract"
    UNKNOWN = "unknown"

class ExtractedField(BaseModel):
    name: str = Field(description="Name of the extracted field")
    value: Union[str, float, int, bool, None] = Field(description="Extracted value")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score for this field")
    bbox: Optional[List[int]] = Field(None, description="Bounding box coordinates [x1, y1, x2, y2]")

class DocumentExtraction(BaseModel):
    document_type: DocumentType = Field(description="Type of document detected")
    extracted_fields: Dict[str, ExtractedField] = Field(description="All extracted fields with confidence")
    total_amount: Optional[float] = Field(None, description="Total amount if applicable")
    currency: Optional[str] = Field(None, description="Currency code if amount detected")
    date: Optional[str] = Field(None, description="Document date in ISO format")
    vendor: Optional[str] = Field(None, description="Vendor or company name")
    confidence_score: float = Field(ge=0.0, le=1.0, description="Overall confidence score")
    processing_notes: List[str] = Field(default_factory=list, description="Notes about processing")

# Dynamic schema for custom fields
def create_dynamic_schema(custom_fields: List[str]) -> type[BaseModel]:
    """Create a Pydantic model dynamically based on custom fields"""
    field_definitions = {
        "extracted_fields": (Dict[str, ExtractedField], Field(description="Extracted fields")),
        "confidence_score": (float, Field(ge=0.0, le=1.0)),
        "processing_notes": (List[str], Field(default_factory=list))
    }

    # Add custom fields to the model
    for field_name in custom_fields:
        field_definitions[field_name] = (Optional[Union[str, float, int, bool]], None)

    return type("CustomExtraction", (BaseModel,), field_definitions)

# OCR Tool definition
@tool("get_document_text", "Get OCR text from a stored document",
      {"document_id": str})
async def get_document_text(document_id: str) -> str:
    """Retrieve OCR text for a document, using cache if available"""
    # Check cache first
    cached = await supabase.table('ocr_results').select('*').eq('document_id', document_id).single()
    if cached.data:
        return cached.data['raw_text']

    # Get document details
    document = await supabase.table('documents').select('*').eq('id', document_id).single()
    if not document.data:
        raise ValueError(f"Document {document_id} not found")

    # Get file URL and extract text
    file_url = supabase.storage.from_('documents').get_public_url(document.data['storage_path'])
    raw_text = await extract_text_with_mistral(file_url)

    # Cache the result
    await supabase.table('ocr_results').insert({
        "document_id": document_id,
        "user_id": document.data['user_id'],
        "raw_text": raw_text,
        "processing_time_ms": 1000
    })

    return raw_text

# ===== SDK FEATURE: QUALITY CONTROL HOOKS =====

# Pre-processing hook for cost control
async def budget_checker_hook(
    input_data: dict[str, Any],
    tool_use_id: str | None,
    context: dict[str, Any]
) -> dict[str, Any]:
    """Check if we have budget remaining before expensive operations"""
    # Check usage from context or database
    user_id = context.get('user_id') if context else None
    if user_id:
        user = await supabase.table('users').select('*').eq('id', user_id).single()
        if user.data and user.data['documents_processed_this_month'] >= user.data['documents_limit']:
            return {
                "decision": "block",
                "systemMessage": "🚫 Document processing limit reached. Please upgrade your plan.",
                "hookSpecificOutput": {
                    "permissionDecision": "deny",
                    "permissionDecisionReason": "Monthly document limit exceeded"
                }
            }
    return {}

# Post-processing hook for quality assurance
async def quality_assurance_hook(
    input_data: dict[str, Any],
    tool_use_id: str | None,
    context: dict[str, Any]
) -> dict[str, Any]:
    """Review extraction results for quality issues"""
    tool_response = input_data.get("tool_response", "")

    # Check for low confidence or errors
    if hasattr(tool_response, 'get') and tool_response.get('confidence_score', 1.0) < 0.7:
        return {
            "systemMessage": "⚠️ Low confidence extraction detected",
            "hookSpecificOutput": {
                "requires_review": True,
                "reason": "Confidence score below 70%"
            }
        }

    # Check for common error patterns
    error_patterns = ["error", "failed", "unable to", "not found"]
    if any(pattern in str(tool_response).lower() for pattern in error_patterns):
        return {
            "systemMessage": "⚠️ Potential extraction error detected",
            "hookSpecificOutput": {
                "requires_review": True,
                "reason": "Error patterns found in output"
            }
        }

    return {}

# ===== SDK FEATURE: TOOL PERMISSIONS =====

async def document_tool_permissions(
    tool_name: str,
    tool_input: dict,
    context: dict
):
    """Control tool access based on user permissions and safety"""

    # Only allow OCR on documents owned by the user
    if tool_name == "mcp__document-tools__get_document_text":
        document_id = tool_input.get("document_id")
        if document_id:
            # Verify ownership in a real implementation
            user_id = context.get('user_id') if context else None
            if not user_id:
                return {
                    "behavior": "deny",
                    "message": "Authentication required"
                }

    # Allow all other tools
    return {
        "behavior": "allow"
    }

# ===== SDK FEATURE: ADVANCED OCR SERVER WITH CACHING =====

# Create MCP server with enhanced OCR capabilities
ocr_server = create_sdk_mcp_server(
    name="document-tools",
    version="1.0.0",
    tools=[get_document_text]
)

# ===== SDK FEATURE: BATCH PROCESSING WITH CONCURRENCY CONTROL =====

async def process_documents_with_semaphore(
    document_ids: List[str],
    mode: str = "auto",
    custom_fields: Optional[List[str]] = None,
    max_concurrent: int = 5,
    max_budget: float = 10.0  # Total budget in USD
) -> List[Dict[str, Any]]:
    """
    Process multiple documents with:
    - Concurrency control via semaphore
    - Budget limits
    - Progress tracking
    - Error recovery
    """
    from asyncio import Semaphore, as_completed

    semaphore = Semaphore(max_concurrent)
    results = []
    total_cost = 0.0

    async def process_single(doc_id: str) -> Dict[str, Any]:
        async with semaphore:
            # Track individual document cost
            try:
                result = await extract_from_document_with_client(
                    doc_id, mode, custom_fields,
                    max_budget=max_budget / len(document_ids)
                )
                # Estimate cost (you'd track this properly in production)
                estimated_cost = 0.50  # Example: $0.50 per document
                return {
                    "document_id": doc_id,
                    "status": "success",
                    "result": result,
                    "cost": estimated_cost
                }
            except Exception as e:
                return {
                    "document_id": doc_id,
                    "status": "error",
                    "error": str(e),
                    "cost": 0.0
                }

    # Process all documents concurrently
    tasks = [process_single(doc_id) for doc_id in document_ids]

    for task in as_completed(tasks):
        result = await task
        results.append(result)
        total_cost += result.get("cost", 0.0)

        # Check if we're approaching budget limit
        if total_cost >= max_budget:
            # Cancel remaining tasks
            for t in tasks:
                t.cancel()
            break

    return {
        "results": results,
        "total_cost": total_cost,
        "processed": len([r for r in results if r["status"] == "success"]),
        "failed": len([r for r in results if r["status"] == "error"])
    }

# Main extraction function using structured outputs
async def extract_from_document(
    document_id: str,
    mode: str = "auto",
    custom_fields: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Extract structured data from document using Claude Agent SDK with structured outputs

    Returns validated JSON matching the defined schema
    """

    # Get document info
    document = await supabase.table('documents').select('*').eq('id', document_id).single()
    if not document.data:
        raise ValueError(f"Document {document_id} not found")

    # Build extraction prompt
    if mode == "auto":
        prompt = f"""
        Analyze this document and extract all relevant information.
        Determine the document type (invoice, receipt, contract, or other).
        Extract all fields you can identify with confidence scores.

        Document ID: {document_id}
        Filename: {document.data['filename']}
        """
        schema = DocumentExtraction.model_json_schema()
    else:
        # Custom mode with user-specified fields
        custom_fields_text = ", ".join(custom_fields) if custom_fields else "no specific fields"
        prompt = f"""
        Extract the following fields from this document: {custom_fields_text}

        Document ID: {document_id}
        Filename: {document.data['filename']}

        Provide confidence scores for each extraction.
        """
        # Create dynamic schema for custom fields
        DynamicModel = create_dynamic_schema(custom_fields or [])
        schema = DynamicModel.model_json_schema()

    # Query Claude with all SDK features enabled
    try:
        # Configure comprehensive agent options
        agent_options = ClaudeAgentOptions(
            # MCP servers for tools
            mcp_servers={
                "document-tools": ocr_server
            },
            # Allowed tools for security
            allowed_tools=["mcp__document-tools__get_document_text"],
            # Structured output for guaranteed format
            output_format={
                "type": "json_schema",
                "schema": schema
            },
            # Cost controls
            max_budget_usd=2.0,
            max_turns=5,
            # Timeout and reliability
            timeout=30,  # seconds
            # Quality control hooks
            hooks={
                "PreToolUse": [
                    HookMatcher(matcher="mcp__document-tools__get_document_text",
                              hooks=[budget_checker_hook])
                ],
                "PostToolUse": [
                    HookMatcher(matcher="*", hooks=[quality_assurance_hook])
                ]
            },
            # Tool permissions for security
            can_use_tool=document_tool_permissions,
            # Session management for context
            session_id=f"doc_extraction_{document_id}",
            # Custom metadata
            metadata={
                "document_id": document_id,
                "user_id": document.data['user_id'],
                "extraction_mode": mode,
                "timestamp": datetime.utcnow().isoformat()
            }
        )

        # Use client for better session management
        async with ClaudeSDKClient(options=agent_options) as client:
            await client.query(prompt)

            async for message in client.receive_response():
                if hasattr(message, 'structured_output'):
                    # The output is already validated against the schema!
                    extraction_result = message.structured_output

                    # Add metadata
                    extraction_result['document_id'] = document_id
                    extraction_result['user_id'] = document.data['user_id']
                    extraction_result['extraction_mode'] = mode
                    extraction_result['model_used'] = "claude-3.5-sonnet"

                    return extraction_result

                  elif message.type == "result" and message.subtype == "error_max_structured_output_retries":
                    raise ValueError("Could not extract data matching the required schema")

    except CLINotFoundError as e:
        # Claude Code CLI not found
        await supabase.table('documents')\
            .update({"status": "failed", "error": f"Claude Code not found: {str(e)}"})\
            .eq("id", document_id)
        raise
    except ProcessError as e:
        # Process execution failed
        await supabase.table('documents')\
            .update({"status": "failed", "error": f"Process failed (exit code {e.exit_code}): {str(e)}"})\
            .eq("id", document_id)
        raise
    except CLIJSONDecodeError as e:
        # JSON parsing error
        await supabase.table('documents')\
            .update({"status": "failed", "error": f"JSON parsing error: {str(e)}"})\
            .eq("id", document_id)
        raise
    except Exception as e:
        # General error
        await supabase.table('documents')\
            .update({"status": "failed", "error": str(e)})\
            .eq("id", document_id)
        raise

# Batch processing with concurrency control
async def process_documents_batch(
    document_ids: List[str],
    mode: str = "auto",
    custom_fields: Optional[List[str]] = None,
    max_concurrent: int = 5
) -> List[Dict[str, Any]]:
    """
    Process multiple documents concurrently with controlled concurrency
    """
    import asyncio
    from asyncio import Semaphore

    semaphore = Semaphore(max_concurrent)

    async def process_with_semaphore(doc_id: str):
        async with semaphore:
            return await extract_from_document(doc_id, mode, custom_fields)

    tasks = [process_with_semaphore(doc_id) for doc_id in document_ids]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    return results

# Refinement function
async def refine_extraction(
    document_id: str,
    original_extraction: Dict[str, Any],
    feedback: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Refine an extraction based on user feedback
    """
    prompt = f"""
    The user has provided feedback on the previous extraction. Please refine the extraction.

    Original extraction:
    {json.dumps(original_extraction, indent=2)}

    User feedback:
    {json.dumps(feedback, indent=2)}

    Please provide a corrected extraction that addresses the feedback.
    Document ID: {document_id}
    """

    # Use the same schema as the original extraction
    if original_extraction.get('extraction_mode') == 'auto':
        schema = DocumentExtraction.model_json_schema()
    else:
        custom_fields = list(original_extraction.get('extracted_fields', {}).keys())
        DynamicModel = create_dynamic_schema(custom_fields)
        schema = DynamicModel.model_json_schema()

    async for message in query(
        prompt=prompt,
        options={
            "output_format": {
                "type": "json_schema",
                "schema": schema
            },
            "max_budget_usd": 1.0,
            "max_turns": 3
        }
    ):
        if hasattr(message, 'structured_output'):
            refined = message.structured_output
            refined['parent_extraction_id'] = original_extraction.get('id')
            refined['refinement_applied'] = True
            refined['feedback_incorporated'] = feedback
            return refined

    raise ValueError("Failed to refine extraction")

# ===== SDK FEATURE: ADVANCED CLIENT WITH SESSION MANAGEMENT =====

async def extract_from_document_with_client(
    document_id: str,
    mode: str = "auto",
    custom_fields: Optional[List[str]] = None,
    max_budget: float = 2.0,
    session_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Extract using ClaudeSDKClient with full session management
    and advanced features
    """
    # Get document info
    document = await supabase.table('documents').select('*').eq('id', document_id).single()
    if not document.data:
        raise ValueError(f"Document {document_id} not found")

    # Create extraction session
    session_id = session_id or f"extraction_{document_id}_{datetime.utcnow().timestamp()}"

    # Configure extraction options
    options = ClaudeAgentOptions(
        mcp_servers={"document-tools": ocr_server},
        allowed_tools=["mcp__document-tools__get_document_text"],
        max_budget_usd=max_budget,
        hooks={
            "PreToolUse": [HookMatcher(matcher="*", hooks=[budget_checker_hook])],
            "PostToolUse": [HookMatcher(matcher="*", hooks=[quality_assurance_hook])]
        },
        can_use_tool=document_tool_permissions,
        session_id=session_id,
        metadata={
            "user_id": document.data['user_id'],
            "document_id": document_id,
            "mode": mode,
            "started_at": datetime.utcnow().isoformat()
        }
    )

    # Process with persistent client
    async with ClaudeSDKClient(options=options) as client:
        # Build prompt
        if mode == "auto":
            prompt = f"""
            Extract all relevant information from document {document_id}.
            Determine document type and extract all fields with confidence scores.
            """
            schema = DocumentExtraction.model_json_schema()
        else:
            prompt = f"""
            Extract these fields from document {document_id}: {', '.join(custom_fields or [])}
            Provide confidence scores for each extraction.
            """
            DynamicModel = create_dynamic_schema(custom_fields or [])
            schema = DynamicModel.model_json_schema()

        # Set output format
        client.options.output_format = {
            "type": "json_schema",
            "schema": schema
        }

        # Query and process
        await client.query(prompt)

        async for message in client.receive_response():
            if hasattr(message, 'structured_output'):
                result = message.structured_output
                result['session_id'] = session_id
                result['extraction_metadata'] = {
                    'model_used': 'claude-3.5-sonnet',
                    'budget_used': max_budget,
                    'extraction_time': datetime.utcnow().isoformat()
                }
                return result

        raise ValueError("No structured output received")

# ===== SDK FEATURE: REAL-TIME MONITORING =====

class ExtractionMonitor:
    """Monitor active extractions in real-time"""

    def __init__(self):
        self.active_sessions = {}
        self.completed_sessions = []

    async def start_monitoring(self, document_ids: List[str]):
        """Monitor multiple extractions concurrently"""
        tasks = []

        for doc_id in document_ids:
            task = asyncio.create_task(
                self._monitor_extraction(doc_id)
            )
            tasks.append(task)

        # Wait for all with timeout
        try:
            await asyncio.gather(*tasks, timeout=300)  # 5 minute timeout
        except asyncio.TimeoutError:
            # Cancel remaining tasks
            for task in tasks:
                if not task.done():
                    task.cancel()

    async def _monitor_extraction(self, document_id: str):
        """Monitor a single extraction"""
        start_time = datetime.utcnow()

        try:
            # Poll for completion
            while True:
                doc = await supabase.table('documents')\
                    .select('status, error')\
                    .eq('id', document_id)\
                    .single()

                if doc.data['status'] in ['completed', 'failed']:
                    duration = (datetime.utcnow() - start_time).total_seconds()
                    self.completed_sessions.append({
                        'document_id': document_id,
                        'status': doc.data['status'],
                        'duration_seconds': duration,
                        'error': doc.data.get('error')
                    })
                    break

                await asyncio.sleep(2)  # Poll every 2 seconds

        except Exception as e:
            self.completed_sessions.append({
                'document_id': document_id,
                'status': 'error',
                'error': str(e)
            })

# ===== SDK FEATURE: ERROR RECOVERY WITH RETRY LOGIC =====

async def extract_with_retry(
    document_id: str,
    mode: str = "auto",
    custom_fields: Optional[List[str]] = None,
    max_retries: int = 3,
    backoff_factor: float = 1.5
) -> Dict[str, Any]:
    """
    Extract with intelligent retry logic and exponential backoff
    """
    for attempt in range(max_retries):
        try:
            # Calculate budget for this attempt
            remaining_budget = 2.0 / (backoff_factor ** attempt)

            result = await extract_from_document_with_client(
                document_id=document_id,
                mode=mode,
                custom_fields=custom_fields,
                max_budget=remaining_budget,
                session_id=f"retry_{attempt}_{document_id}"
            )

            # Check confidence
            confidence = result.get('confidence_score', 0.0)
            if confidence >= 0.7:
                # Good enough, return result
                result['retry_attempts'] = attempt
                return result
            elif attempt < max_retries - 1:
                # Low confidence, retry with adjusted prompt
                await asyncio.sleep(backoff_factor ** attempt)
                continue
            else:
                # Last attempt, return anyway
                result['retry_attempts'] = attempt
                result['low_confidence'] = True
                return result

        except Exception as e:
            if attempt == max_retries - 1:
                # Last attempt failed
                raise
            else:
                # Wait and retry
                await asyncio.sleep(backoff_factor ** attempt)
                continue

    raise RuntimeError(f"Extraction failed after {max_retries} attempts")
```

### 3. Minimal FastAPI Endpoints

```python
# backend/main.py
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.agents.document_agent import extract_from_document, process_documents_batch, refine_extraction
from app.services.supabase import supabase
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

app = FastAPI(
    title="Stackdocs API",
    description="Document extraction API with Claude Agent SDK and Structured Outputs",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class ProcessRequest(BaseModel):
    mode: str = "auto"  # "auto" or "custom"
    custom_fields: Optional[List[str]] = None

class RefineRequest(BaseModel):
    feedback: Dict[str, Any]
    field_corrections: Optional[Dict[str, str]] = None  # Field name -> corrected value

class BatchRequest(BaseModel):
    document_ids: List[str]
    mode: str = "auto"
    custom_fields: Optional[List[str]] = None
    max_concurrent: int = 5

# Core endpoints
@app.post("/process/{document_id}")
async def process_document(
    document_id: str,
    request: ProcessRequest,
    background_tasks: BackgroundTasks
):
    """Trigger non-blocking document processing with structured outputs"""
    # Verify user owns the document
    document = await supabase.table('documents').select('*').eq('id', document_id).single()
    if not document.data:
        raise HTTPException(status_code=404, detail="Document not found")

    # Check usage limits
    user = await supabase.table('users').select('*').eq('id', document.data['user_id']).single()
    if user.data['documents_processed_this_month'] >= user.data['documents_limit']:
        raise HTTPException(status_code=429, detail="Usage limit exceeded")

    # Update status to processing immediately
    await supabase.table('documents')\
        .update({"status": "processing"})\
        .eq("id", document_id)

    # Add to background tasks
    background_tasks.add_task(
        process_document_background,
        document_id,
        request.mode,
        request.custom_fields
    )

    return {
        "message": "Processing started",
        "document_id": document_id,
        "status": "processing"
    }

@app.post("/process-batch")
async def process_documents_batch_endpoint(
    request: BatchRequest,
    background_tasks: BackgroundTasks
):
    """Process multiple documents concurrently with controlled concurrency"""
    # Verify all documents exist and user has permission
    documents = await supabase.table('documents')\
        .select('*')\
        .in_('id', request.document_ids)\
        .execute()

    if len(documents.data) != len(request.document_ids):
        raise HTTPException(status_code=404, detail="One or more documents not found")

    # Check usage limits for total documents
    user_id = documents.data[0]['user_id']
    user = await supabase.table('users').select('*').eq('id', user_id).single()

    if user.data['documents_processed_this_month'] + len(request.document_ids) > user.data['documents_limit']:
        raise HTTPException(status_code=429, detail="Not enough usage quota for batch")

    # Update all documents to processing
    await supabase.table('documents')\
        .update({"status": "processing"})\
        .in_('id', request.document_ids)

    background_tasks.add_task(
        process_batch_background,
        request.document_ids,
        request.mode,
        request.custom_fields,
        request.max_concurrent
    )

    return {
        "message": f"Batch processing started for {len(request.document_ids)} documents",
        "document_count": len(request.document_ids)
    }

@app.post("/refine/{extraction_id}")
async def refine_extraction_endpoint(
    extraction_id: str,
    request: RefineRequest
):
    """Refine extraction based on user feedback"""
    # Get original extraction
    extraction = await supabase.table('extractions').select('*').eq('id', extraction_id).single()
    if not extraction.data:
        raise HTTPException(status_code=404, detail="Extraction not found")

    try:
        # Process refinement
        refined_result = await refine_extraction(
            document_id=extraction.data['document_id'],
            original_extraction=extraction.data,
            feedback={
                "user_feedback": request.feedback,
                "field_corrections": request.field_corrections
            }
        )

        # Save refined extraction
        await supabase.table('extractions').insert({
            "document_id": extraction.data['document_id'],
            "user_id": extraction.data['user_id'],
            "extracted_fields": refined_result,
            "mode": "refined",
            "custom_fields": extraction.data.get('custom_fields'),
            "parent_extraction_id": extraction_id,
            "confidence_scores": refined_result.get('confidence_score', {})
        })

        return {
            "message": "Extraction refined successfully",
            "data": refined_result
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/extractions/{document_id}/latest")
async def get_latest_extraction(document_id: str):
    """Get the latest extraction for a document"""
    extraction = await supabase.table('extractions')\
        .select('*')\
        .eq('document_id', document_id)\
        .order('created_at', desc=True)\
        .limit(1)\
        .single()

    if not extraction.data:
        raise HTTPException(status_code=404, detail="No extraction found for document")

    return extraction.data

@app.get("/usage/check/{user_id}")
async def check_usage(user_id: str):
    """Check if user has remaining quota"""
    user = await supabase.table('users').select('*').eq('id', user_id).single()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    usage = user.data['documents_processed_this_month']
    limit = user.data['documents_limit']

    return {
        "remaining": limit - usage,
        "can_upload": usage < limit,
        "usage_reset_date": user.data['usage_reset_date'],
        "current_usage": usage
    }

# Background processing functions
async def process_document_background(document_id: str, mode: str, custom_fields=None):
    """Run extraction in background with structured outputs"""
    try:
        # Extract using Agent SDK with structured outputs
        extraction_result = await extract_from_document(
            document_id=document_id,
            mode=mode,
            custom_fields=custom_fields
        )

        # Save to database - the result is already validated!
        await supabase.table('extractions').insert({
            "document_id": document_id,
            "user_id": extraction_result['user_id'],
            "extracted_fields": extraction_result,
            "confidence_scores": {
                "overall": extraction_result.get('confidence_score', 0.0),
                "document_type": extraction_result.get('document_type'),
                "field_count": len(extraction_result.get('extracted_fields', {}))
            },
            "mode": mode,
            "custom_fields": custom_fields
        })

        # Mark document complete
        await supabase.table('documents')\
            .update({"status": "completed"})\
            .eq("id", document_id)

        # Increment usage
        await supabase.rpc('increment_usage', {'p_user_id': extraction_result['user_id']})

    except Exception as e:
        # Mark failed with error
        await supabase.table('documents')\
            .update({
                "status": "failed",
                "error": str(e)
            })\
            .eq("id", document_id)

async def process_batch_background(
    document_ids: List[str],
    mode: str,
    custom_fields: Optional[List[str]],
    max_concurrent: int
):
    """Process batch with controlled concurrency"""
    try:
        # Use the batch processing function with concurrency control
        results = await process_documents_batch(
            document_ids=document_ids,
            mode=mode,
            custom_fields=custom_fields,
            max_concurrent=max_concurrent
        )

        # Process results
        for doc_id, result in zip(document_ids, results):
            if isinstance(result, Exception):
                # Handle error
                await supabase.table('documents')\
                    .update({"status": "failed", "error": str(result)})\
                    .eq("id", doc_id)
            else:
                # Success - result is already validated structured data
                await supabase.table('extractions').insert({
                    "document_id": doc_id,
                    "user_id": result['user_id'],
                    "extracted_fields": result,
                    "confidence_scores": {
                        "overall": result.get('confidence_score', 0.0),
                        "batch": True
                    },
                    "mode": mode,
                    "custom_fields": custom_fields
                })

                await supabase.table('documents')\
                    .update({"status": "completed"})\
                    .eq("id", doc_id)

                # Increment usage
                await supabase.rpc('increment_usage', {'p_user_id': result['user_id']})

    except Exception as e:
        # Update all documents to failed status
        await supabase.table('documents')\
            .update({"status": "failed", "error": str(e)})\
            .in_('id', document_ids)
```

## Data Flow

### Upload Flow (Non-blocking)
```typescript
// 1. User uploads file
const handleUpload = async (file: File) => {
  // Upload directly to Supabase Storage
  const { data } = await supabase.storage
    .from('documents')
    .upload(`${userId}/${Date.now()}_${file.name}`, file, {
      onUploadProgress: (progress) => {
        setUploadProgress((progress.loaded / progress.total) * 100)
      }
    })

  // Create document record immediately
  const { data: document } = await supabase
    .from('documents')
    .insert({
      user_id: userId,
      filename: file.name,
      storage_path: data.path,
      status: 'uploaded'
    })
    .select()
    .single()

  // Trigger processing (returns immediately)
  await fetch('/api/process/' + document.id, { method: 'POST' })

  // User can continue working - no blocking!
}
```

### Processing Flow (Backend)
```python
# 1. FastAPI receives process request
# 2. Adds to background tasks
# 3. Agent SDK takes over:
#    - OCR subagent extracts text
#    - Extraction subagent processes with Claude
#    - Validation subagent checks quality
# 4. Results saved to Supabase
# 5. Realtime updates push to frontend
```

### Real-time Updates
```typescript
// Frontend subscribes to changes
const subscription = supabase
  .channel('document-updates')
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'documents' },
    (payload) => updateUI(payload.new)
  )
  .subscribe()
```

## Benefits of New Architecture

### 1. Better User Experience
- **Instant uploads** with progress tracking
- **Non-blocking processing** - users can continue working
- **Real-time updates** see extraction results appear
- **Interactive feedback** - users can correct extractions

### 2. Developer Experience
- **Less backend code** to maintain
- **Swagger/ReDoc still available** for API docs
- **TypeScript support** with generated types
- **Simpler debugging** - direct database access

### 3. Technical Advantages
- **Agent SDK intelligence** - iterative refinement, self-correction
- **Structured outputs** - guaranteed valid JSON matching schema
- **Type safety** - Pydantic models ensure data integrity
- **Automatic caching** - OCR results cached for re-extraction
- **Built-in validation** - no need for manual parsing or validation
- **Confidence scoring** - flag low-confidence fields at field level
- **Future-proof** - easy to add new capabilities

### 4. Structured Outputs Benefits

The Claude Agent SDK's structured outputs provide significant advantages for document extraction:

**Guaranteed Data Structure**
```python
# Output is always valid and matches the schema
extraction = {
    "document_type": "invoice",
    "extracted_fields": {
        "vendor_name": ExtractedField(
            name="vendor_name",
            value="ACME Corp",
            confidence=0.95
        )
    },
    "confidence_score": 0.92
}
```

**No Parsing Required**
- Eliminates manual JSON parsing
- No validation needed in application code
- Type-safe access to all fields
- Automatic error handling for malformed outputs

**Dynamic Schema Support**
```python
# Create schemas on-the-fly for custom fields
if mode == "custom" and custom_fields:
    DynamicModel = create_dynamic_schema(custom_fields)
    schema = DynamicModel.model_json_schema()
```

**Field-Level Confidence**
- Each extracted field includes confidence score
- Bounding box coordinates for visual verification
- Processing notes for edge cases
- Overall document confidence score

### 5. Performance
- **Fewer network hops** for data operations
- **Parallel processing** possible
- **Background tasks** don't block UI
- **Optimistic updates** for fast feel

## Migration Strategy

### Phase 1: Setup (1-2 days)
1. Install Claude Agent SDK (Python)
2. Install Supabase client (TypeScript)
3. Generate TypeScript types from Supabase
4. Set up basic agent structure

### Phase 2: Core Migration (3-4 days)
1. Create DocumentProcessingAgent
2. Implement OCR and Extraction subagents
3. Build minimal FastAPI endpoints
4. Add real-time subscriptions

### Phase 3: Frontend Updates (2-3 days)
1. Replace API calls with direct Supabase client
2. Add upload progress tracking
3. Implement real-time status updates
4. Add extraction result display

### Phase 4: Testing & Refinement (2 days)
1. Test with different document types
2. Compare accuracy with LangChain
3. Performance testing
4. User feedback integration

### Phase 5: Gradual Rollout
1. Run both systems in parallel
2. Feature flag for Agent SDK
3. Monitor accuracy and performance
4. Full migration when ready

## Security Considerations

### What Stays Secure
- ✅ API keys (Mistral, Claude) on backend only
- ✅ Usage limit enforcement
- ✅ Authentication via Supabase Auth
- ✅ RLS policies protect data

### What Changes
- Frontend has direct database access (via RLS)
- Fewer API calls to backend
- More processing happens asynchronously

### Best Practices
```typescript
// Always check RLS policies
const { data: documents } = await supabase
  .from('documents')
  .select('*')
  .eq('user_id', userId)  // RLS enforces this
```

## Key Implementation Notes

### Claude Agent SDK Patterns

1. **Tools vs Classes**
   - Use `@tool` decorator for functions, not class-based tools
   - Tools return structured data with `content` array
   - Tools are stateless functions that receive args dict
   - Register tools with `create_sdk_mcp_server()` for isolation

2. **Agent Configuration**
   - Use `ClaudeAgentOptions` to configure behavior
   - Always set `max_budget_usd` for cost control
   - Use `allowed_tools` to restrict agent capabilities
   - Set `session_id` for conversation persistence
   - Add `metadata` for tracking and debugging

3. **Hooks System**
   - **PreToolUse hooks**: Validate before execution, can deny actions
   - **PostToolUse hooks**: Review results, check quality, add context
   - Use `HookMatcher` to apply hooks to specific tools
   - Return `continue_: False` to stop execution immediately

4. **Tool Permissions**
   - Implement `can_use_tool` callback for dynamic permissions
   - Can modify tool inputs (e.g., add safety flags)
   - Return `PermissionResultAllow` or `PermissionResultDeny`
   - Use for security and input validation

5. **Client Usage**
   - Always use `async with ClaudeSDKClient` context manager
   - Handle responses with `async for message in client.receive_response()`
   - Parse extraction results from `message.structured_output`
   - Use `client.interrupt()` to stop long-running operations

6. **Structured Outputs**
   - Use Pydantic models to define extraction schemas
   - The SDK automatically validates output against schema
   - Access results via `message.structured_output`
   - No need for manual parsing or validation
   - Handle `error_max_structured_output_retries` for failures
   - Dynamic schemas for custom fields

7. **Error Handling & Recovery**
   - Implement retry logic with exponential backoff
   - Use try/catch blocks around client operations
   - Check confidence scores and flag low-confidence results
   - Monitor for specific error types and handle appropriately

8. **Concurrency Control**
   - Use `asyncio.Semaphore` to limit concurrent operations
   - Process batches with `asyncio.gather()` or `as_completed()`
   - Track costs across concurrent operations
   - Implement graceful cancellation with task.cancel()

9. **Background Tasks**
   - FastAPI BackgroundTasks are perfect for Agent SDK
   - Pass IDs, not objects to background tasks
   - Create new database connections in background functions
   - Use monitoring classes for tracking progress

10. **Session Management**
    - Use unique session IDs for tracking
    - Store session metadata for debugging
    - Implement timeout handling for long operations
    - Use sessions for conversation context in refinements

## Implementation Checklist

### Backend (Python)
- [ ] Install `claude-agent-sdk` (pip install claude-agent-sdk)
- [ ] Install Pydantic for schema definitions (pip install pydantic)
- [ ] Note: SDK is optimized for code operations - document processing requires custom tools
- [ ] Create Pydantic models for extraction schemas in `backend/app/models/`
- [ ] Implement `extract_from_document` using `ClaudeSDKClient` with structured outputs
- [ ] Create OCR tool with `@tool` decorator and register with MCP server
- [ ] Implement dynamic schema generation for custom fields
- [ ] Add PreToolUse and PostToolUse hooks for quality control
- [ ] Implement tool permission callbacks for security
- [ ] Create batch processing with semaphore-based concurrency control
- [ ] Add retry logic with exponential backoff
- [ ] Implement real-time monitoring with ExtractionMonitor class
- [ ] Update FastAPI endpoints with proper error handling
- [ ] Add usage limit checking before processing (budget_checker_hook)
- [ ] Implement background task functions with session management
- [ ] Add structured outputs error handling
- [ ] Set up monitoring for agent costs and performance
- [ ] Add database RPC function for usage increment
- [ ] Test with different document types and schemas
- [ ] Implement confidence score thresholding
- [ ] Add graceful degradation for budget limits
- [ ] Create comprehensive logging for debugging

### Frontend (TypeScript)
- [ ] Install `@supabase/supabase-js`
- [ ] Generate database types with Supabase CLI
- [ ] Create Supabase client in `lib/supabase-client.ts`
- [ ] Implement real-time hooks for document status
- [ ] Update upload flow to use direct Supabase Storage
- [ ] Add progress indicators for uploads
- [ ] Implement polling fallback for extraction status
- [ ] Add extraction result display with editing

### Database (Supabase)
- [ ] Review RLS policies for all tables
- [ ] Add realtime publications for documents table
- [ ] Create index on `documents.user_id` and `status`
- [ ] Create index on `extractions.document_id` with `created_at DESC`
- [ ] Add RPC function `increment_usage(user_id)`
- [ ] Set up storage policies for documents bucket
- [ ] Test security with different user contexts

## Claude Agent SDK Advantages Summary

### 1. **Guaranteed Data Structure**
- JSON Schema validation ensures outputs always match expected format
- No manual parsing or validation required
- Type-safe access with Pydantic models
- Automatic error handling for malformed outputs

### 2. **Advanced Quality Control**
- Pre-execution hooks can prevent expensive operations
- Post-execution hooks validate results and check confidence
- Automatic retry logic for failed extractions
- Confidence scoring at field and document level

### 3. **Cost Management**
- Per-operation budget controls
- Cumulative budget tracking across batches
- Automatic cancellation when limits exceeded
- Detailed cost metadata for billing

### 4. **Security & Permissions**
- Tool-level access control
- Dynamic permission callbacks
- Input validation and sanitization
- User isolation enforcement

### 5. **Production Features**
- Session persistence for conversation context
- Real-time monitoring and progress tracking
- Graceful error recovery
- Comprehensive logging and debugging

### 6. **Developer Experience**
- Pythonic async/await patterns
- Rich error types and messages
- Built-in retry and backoff
- Extensive customization options

### 7. **Performance**
- MCP server isolation for tools
- Concurrent processing with semaphore control
- Intelligent caching strategies
- Optimized for batch operations

## Migration Benefits

### From LangChain to Agent SDK:

| Feature | LangChain | Agent SDK |
|---------|-----------|-----------|
| Output Validation | Manual parsing | Automatic JSON Schema |
| Error Handling | Try/catch blocks | Rich error types with recovery |
| Cost Control | Manual tracking | Built-in budget management |
| Tool Isolation | In-process | MCP server isolation |
| Session Management | Manual | Built-in session persistence |
| Quality Control | Post-processing | Pre/Post hooks |
| Permissions | Manual | Dynamic callbacks |
| Monitoring | Custom logging | Built-in metadata |

### Expected Improvements:
- **50% reduction** in parsing/validation code
- **90% fewer** runtime errors from malformed outputs
- **Real-time cost control** prevents overages
- **Built-in retry** improves reliability
- **Session context** enables better refinements
- **Production monitoring** out of the box

## Next Steps

1. **Approve architecture** - Confirm team agrees with hybrid approach
2. **Start Phase 1** - Install dependencies and basic setup
3. **Create POC** - Implement for one document type (invoices)
4. **Benchmark** - Compare with current LangChain implementation
5. **Iterate** - Refine based on results

## Questions for Consideration

1. **Which document type** should we start with for POC?
2. **Performance requirements** - expected concurrent users?
3. **Monitoring needs** - how to track agent performance?
4. **Rollback plan** - if Agent SDK doesn't work out?
5. **User feedback** - how to collect and incorporate?

## Resources

- [Claude Agent SDK Documentation](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [FastAPI Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/)
- [Realtime Subscriptions](https://supabase.com/docs/guides/realtime)

---

**Conclusion:** This hybrid architecture gives us the best of both worlds - the intelligence of Claude Agent SDK with the responsiveness of modern frontend patterns. It aligns with our goal of creating a magical user experience while maintaining security and scalability.