# Agent SDK Migration - Incremental Implementation

**Status**: Phase 5 Complete ✓
**Approach**: Build alongside existing code, spike test first, add features gradually

---

## Quick Status (Updated 2024-12-18)

### ✅ Completed

| Phase | What's Done |
|-------|-------------|
| Phase 1 | SDK installs, basic query works |
| Phase 2 | Session persistence verified (within-session + cross-process resume) |
| Phase 3 | @tool decorator, MCP server, multi-turn agent working |
| Phase 4 | `agent_extractor.py` service created with streaming |
| Phase 5 | `/api/agent/extract` and `/api/agent/correct` routes created |

### 🔲 Remaining

| Phase | What's Left |
|-------|-------------|
| Phase 6 | Full integration test: upload → OCR → extract → save → correct |
| Phase 6 | Session fallback handling (expired/missing sessions) |
| Phase 7 | Frontend: `useAgentExtraction` hook |
| Phase 7 | Frontend: Streaming thinking display |
| Phase 7 | Frontend: Correction input with session resume |

### 📁 Key Files Created

- `backend/app/services/agent_extractor.py` - Core extraction service
- `backend/app/routes/agent.py` - SSE streaming endpoints
- `backend/spikes/` - Spike test scripts

### ➡️ After This

See `Next-Stacks-Implementation.md` for the Stacks feature that builds on this work.

---

## Philosophy

**Don't break what works.** The current `extractor.py` and endpoints (`/api/process`, `/api/re-extract`) stay untouched. We build the Agent SDK implementation in parallel:

| Existing (Keep) | New (Build) |
|-----------------|-------------|
| `services/extractor.py` | `services/agent_extractor.py` |
| `routes/process.py` | `routes/agent.py` |
| `POST /api/process` | `POST /api/agent/process` |
| `POST /api/re-extract` | `POST /api/agent/extract` |

When the new implementation is proven, frontend can switch to the new endpoints. Old endpoints remain as fallback.

---

## Why This Migration

| Current (Anthropic SDK) | Target (Agent SDK) |
|-------------------------|-------------------|
| Single API call, no memory | Session-based with memory |
| Manual streaming handling | Built-in streaming |
| No conversation context | Full conversation resume |
| User correction = fresh call | User correction = resume session |

---

## Phase 1: Spike - Basic SDK Integration

**Goal**: Get the SDK working and see output in the terminal. No endpoints, no database, just console logging.

### 1.1 Install SDK

```bash
cd backend
pip install claude-agent-sdk
```

Update `requirements.txt`:
```diff
  anthropic>=0.40.0        # Keep existing
+ claude-agent-sdk>=1.0.0  # Add new
```

### 1.2 Create Spike Script

Create `backend/spike_agent_sdk.py` - a standalone test script:

```python
"""
Spike test: Verify Agent SDK works and understand message structure.
Run with: python spike_agent_sdk.py
"""

import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage, TextBlock, ResultMessage

SAMPLE_TEXT = """
INVOICE
Invoice #: INV-2024-001
Date: January 15, 2024

From: Acme Corporation
123 Business St, Sydney NSW 2000

To: Customer Company
456 Client Ave, Melbourne VIC 3000

Items:
- Widget A x 10 @ $50 = $500
- Widget B x 5 @ $100 = $500
- Service Fee = $200

Subtotal: $1,200
GST (10%): $120
Total: $1,320
"""

async def main():
    print("=== Agent SDK Spike Test ===\n")

    prompt = f"Analyze this document and tell me what you see:\n\n{SAMPLE_TEXT}"

    options = ClaudeAgentOptions(
        max_turns=1,  # Single turn for spike
    )

    print("Sending query to Agent SDK...\n")
    print("-" * 50)

    async for message in query(prompt=prompt, options=options):
        print(f"\n[Message Type]: {type(message).__name__}")

        if isinstance(message, AssistantMessage):
            print(f"[Model]: {message.model}")
            print(f"[Stop Reason]: {message.stop_reason}")
            print(f"[Content Blocks]: {len(message.content)}")

            for i, block in enumerate(message.content):
                print(f"\n  Block {i}: {type(block).__name__}")
                if isinstance(block, TextBlock):
                    print(f"  Text: {block.text[:200]}...")

        elif isinstance(message, ResultMessage):
            print(f"[Total Cost]: ${message.total_cost_usd:.4f}")
            print(f"[Input Tokens]: {message.usage.input_tokens}")
            print(f"[Output Tokens]: {message.usage.output_tokens}")

        else:
            # Log unknown message types to understand SDK structure
            print(f"[Raw]: {message}")

    print("\n" + "-" * 50)
    print("Spike complete!")

if __name__ == "__main__":
    asyncio.run(main())
```

### 1.3 Run and Observe

```bash
cd backend
source venv/bin/activate
python spike_agent_sdk.py
```

**What to look for:**
- [x] SDK initializes without errors
- [x] Messages stream (not all at once)
- [x] Understand message type structure
- [x] See cost/token usage
- [x] Note any session_id in messages

### 1.4 Spike Checklist

- [x] SDK installs correctly (v0.1.17)
- [x] Basic query works
- [x] Can see streamed text output
- [x] Understand message structure
- [x] Document any surprises (see Notes section)

---

## Phase 2: Spike - Session Persistence

**Goal**: Verify session resume actually works.

### 2.1 Session Resume Spike

Create `backend/spike_session.py`:

```python
"""
Spike test: Verify session persistence works across queries.
"""

import asyncio
from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AssistantMessage,
    TextBlock,
    ResultMessage
)

async def main():
    print("=== Session Persistence Spike ===\n")

    # First conversation
    print("--- First Query (establish context) ---")

    options = ClaudeAgentOptions()

    async with ClaudeSDKClient(options=options) as client:
        await client.query("Remember this number: 42. It's very important.")

        async for msg in client.receive_response():
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, TextBlock):
                        print(f"Claude: {block.text}")

        print("\n--- Second Query (test memory within session) ---")

        await client.query("What number did I ask you to remember?")

        async for msg in client.receive_response():
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, TextBlock):
                        print(f"Claude: {block.text}")

    print("\n✓ Within-session memory works!" if "42" in block.text else "✗ Memory failed")

if __name__ == "__main__":
    asyncio.run(main())
```

### 2.2 Cross-Process Resume Spike

Create `backend/spike_resume.py`:

```python
"""
Spike test: Verify session can be resumed from session_id.
Run twice - first to create session, second to resume.
"""

import asyncio
import sys
from pathlib import Path
from claude_agent_sdk import (
    query,
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AssistantMessage,
    TextBlock,
    SystemMessage,
    ResultMessage
)

SESSION_FILE = Path("spike_session_id.txt")

async def create_session():
    """First run: create a session and save the ID."""
    print("Creating new session...")

    session_id = None

    async for message in query(prompt="Remember: The secret code is ALPHA-7. Confirm you have it."):
        print(f"[{type(message).__name__}]")

        # Try to find session_id (SDK structure may vary)
        if hasattr(message, 'session_id'):
            session_id = message.session_id
            print(f"  Found session_id: {session_id}")

        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    print(f"  Claude: {block.text[:100]}")

    if session_id:
        SESSION_FILE.write_text(session_id)
        print(f"\n✓ Session saved to {SESSION_FILE}")
    else:
        print("\n✗ Could not capture session_id - check message structure")

async def resume_session():
    """Second run: resume session and test memory."""
    if not SESSION_FILE.exists():
        print("No session file found. Run with 'create' first.")
        return

    session_id = SESSION_FILE.read_text().strip()
    print(f"Resuming session: {session_id}")

    options = ClaudeAgentOptions(resume=session_id)

    async for message in query(prompt="What was the secret code?", options=options):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    print(f"Claude: {block.text}")
                    if "ALPHA-7" in block.text.upper():
                        print("\n✓ Session resume works! Claude remembered the code.")
                    else:
                        print("\n? Claude responded but may not have remembered.")

async def main():
    if len(sys.argv) > 1 and sys.argv[1] == "resume":
        await resume_session()
    else:
        await create_session()
        print("\nNow run: python spike_resume.py resume")

if __name__ == "__main__":
    asyncio.run(main())
```

### 2.3 Session Spike Checklist

- [x] Within-session memory works (ClaudeSDKClient)
- [x] Can capture session_id from messages
- [x] Cross-process resume works (query with resume option)
- [x] Document how to extract session_id
- [x] Document session_id format

---

## Phase 2 Findings (2024-12-18)

### Session ID Details

**Format**: UUID (36 characters)
- Example: `0ad07f74-73cf-47ea-8c47-fd574ca923f8`

**Where to capture**:
1. `SystemMessage.data['session_id']` - Available at session init
2. `ResultMessage.session_id` - Available at query completion (recommended)

### Within-Session Memory (ClaudeSDKClient)

Works correctly. Multiple `client.query()` calls within same `async with ClaudeSDKClient()` context maintain conversation history.

```python
async with ClaudeSDKClient(options=options) as client:
    await client.query("Remember this: 42")
    async for msg in client.receive_response():
        # Process first response
        pass

    await client.query("What number?")
    async for msg in client.receive_response():
        # Claude remembers 42
        pass
```

### Cross-Process Resume

Works correctly. Pass `resume=session_id` in options to continue a previous session.

```python
# Resume with saved session_id
options = ClaudeAgentOptions(
    resume=session_id,  # UUID from previous session
    max_turns=1,
)
async for message in query(prompt="What did I tell you?", options=options):
    # Claude has full context from previous session
    pass
```

### Cost/Performance Observations

- Cost per query: ~$0.006-0.012 (Sonnet 4.5)
- Duration per query: ~2-3 seconds
- Model used: claude-sonnet-4-5-20250929

### Spike Files

- `backend/spikes/spike_session.py` - Within-session memory test
- `backend/spikes/spike_resume.py` - Cross-process resume test
- `backend/spikes/spike_session_id.txt` - Stored session ID (gitignored)

---

## Phase 3: Spike - Custom Tools

**Goal**: Get the extraction tool working with Agent SDK.

### 3.1 Tool Definition Spike

Create `backend/spike_tools.py`:

```python
"""
Spike test: Custom extraction tool with Agent SDK.
"""

import asyncio
import json
from claude_agent_sdk import (
    tool,
    create_sdk_mcp_server,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    AssistantMessage,
    TextBlock,
    ToolUseBlock
)

# Define extraction tool
@tool("save_extracted_data", "Save structured data extracted from document", {
    "extracted_fields": dict,
    "confidence_scores": dict
})
async def save_extraction(args: dict) -> dict:
    print(f"\n[TOOL CALLED] save_extracted_data")
    print(f"  Fields: {json.dumps(args.get('extracted_fields', {}), indent=2)}")
    print(f"  Confidence: {args.get('confidence_scores', {})}")
    return {
        "content": [{"type": "text", "text": "Extraction saved successfully"}]
    }

SAMPLE_INVOICE = """
INVOICE #INV-2024-001
Date: January 15, 2024
Vendor: Acme Corporation
Total: $1,320.00
"""

async def main():
    print("=== Tool Spike Test ===\n")

    # Create tool server
    extraction_server = create_sdk_mcp_server(
        name="extraction",
        tools=[save_extraction]
    )

    options = ClaudeAgentOptions(
        mcp_servers={"extraction": extraction_server},
        allowed_tools=["mcp__extraction__save_extracted_data"],
        max_turns=3
    )

    prompt = f"""Analyze this invoice and extract the key fields using the save_extracted_data tool:

{SAMPLE_INVOICE}

Extract: invoice_number, date, vendor, total
Provide confidence scores for each field."""

    print("Sending query with tool...\n")

    async with ClaudeSDKClient(options=options) as client:
        await client.query(prompt)

        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        print(f"[Thinking]: {block.text[:200]}...")
                    elif isinstance(block, ToolUseBlock):
                        print(f"\n[Tool Use]: {block.name}")
                        print(f"[Tool Input]: {json.dumps(block.input, indent=2)}")

if __name__ == "__main__":
    asyncio.run(main())
```

### 3.2 Tool Spike Checklist

- [x] Tool definition with @tool decorator works
- [x] MCP server creation works
- [x] Claude calls the tool
- [x] Tool receives correct arguments
- [x] Can access tool input from ToolUseBlock
- [x] Multi-turn agent reasoning works
- [x] Auto mode extracts rich nested structures
- [x] Custom mode extracts only requested fields

---

## Phase 3 Findings (2024-12-18)

### @tool Decorator Syntax

The correct syntax uses **positional arguments**:

```python
@tool("tool_name", "description", {"param_name": type})
async def my_tool(args: dict) -> dict:
    return {"content": [{"type": "text", "text": "result"}]}
```

**NOT** keyword arguments like `name=`, `description=`, `parameters=`.

### Tool Input Schema

Simple type hints work:
```python
{"document_id": str}
{"extracted_fields": dict, "confidence_scores": dict}
```

### Multi-Turn Agent Behavior

With `max_turns=5`, the agent:
1. **Turn 1-2**: Reads document with `read_document` tool
2. **Turn 3**: Reasons about content
3. **Turn 4-5**: Calls `save_extracted_data` with structured output

### Cost/Performance

| Mode | Duration | Cost | Turns |
|------|----------|------|-------|
| Auto | ~21s | ~$0.04 | 3 |
| Custom | ~10s | ~$0.03 | 3 |

### Key Discoveries

1. **Tool args may be JSON strings**: The SDK sometimes passes `extracted_fields` as a JSON string instead of dict. Parse with `json.loads()` if needed.

2. **Rich nested structures work**: Auto mode produces beautifully nested objects (vendor, customer, line_items, etc.)

3. **Tool naming convention**: `mcp__[server_name]__[tool_name]`

### Spike Files

- `backend/spikes/spike_tools.py` - Multi-turn tool spike
- `backend/spikes/sample_ocr_output.md` - Sample OCR document

---

## Phase 4: Service Layer

**Goal**: Create `agent_extractor.py` with real extraction logic.

### 4.1 Create Agent Extractor Service

Create `backend/app/services/agent_extractor.py`:

```python
"""
Agent SDK extraction service.

Runs alongside existing extractor.py - does not replace it.
"""

import json
from typing import Any, AsyncIterator
from claude_agent_sdk import (
    tool,
    create_sdk_mcp_server,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    AssistantMessage,
    TextBlock,
    ToolUseBlock,
    ResultMessage
)

from ..config import get_settings

# Reuse prompts from existing extractor
from .extractor import AUTO_PROMPT, CUSTOM_PROMPT


# --- Tool Definition ---

@tool("save_extracted_data", "Save structured data extracted from document", {
    "extracted_fields": dict,
    "confidence_scores": dict
})
async def extraction_tool(args: dict) -> dict:
    """Tool handler - just acknowledges receipt. Actual data captured from ToolUseBlock."""
    return {
        "content": [{"type": "text", "text": "Extraction saved"}]
    }


# Create MCP server (singleton)
_extraction_server = create_sdk_mcp_server(
    name="extraction",
    tools=[extraction_tool]
)


# --- Extraction Functions ---

async def extract_with_agent(
    ocr_text: str,
    mode: str,
    custom_fields: list[str] | None = None
) -> AsyncIterator[dict[str, Any]]:
    """
    Extract data using Agent SDK with streaming.

    Yields events:
        {"type": "thinking", "text": "..."}
        {"type": "complete", "extraction": {...}, "session_id": "...", "thinking": "..."}
        {"type": "error", "message": "..."}
    """
    settings = get_settings()

    # Build prompt (reuse existing logic)
    if mode == "auto":
        prompt = AUTO_PROMPT.format(text=ocr_text)
    else:
        fields_str = ", ".join(custom_fields or [])
        prompt = CUSTOM_PROMPT.format(fields=fields_str, text=ocr_text)

    options = ClaudeAgentOptions(
        mcp_servers={"extraction": _extraction_server},
        allowed_tools=["mcp__extraction__save_extracted_data"],
        max_turns=3,
    )

    thinking_chunks: list[str] = []
    extraction_result: dict | None = None
    session_id: str | None = None

    try:
        async with ClaudeSDKClient(options=options) as client:
            await client.query(prompt)

            async for message in client.receive_response():
                # Capture session_id if available
                if hasattr(message, 'session_id') and message.session_id:
                    session_id = message.session_id

                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if isinstance(block, TextBlock):
                            thinking_chunks.append(block.text)
                            yield {"type": "thinking", "text": block.text}

                        elif isinstance(block, ToolUseBlock):
                            if block.name == "mcp__extraction__save_extracted_data":
                                extraction_result = block.input

        # Yield completion
        if extraction_result:
            yield {
                "type": "complete",
                "extraction": extraction_result,
                "session_id": session_id,
                "thinking": "".join(thinking_chunks)
            }
        else:
            yield {"type": "error", "message": "No extraction result from Claude"}

    except Exception as e:
        yield {"type": "error", "message": str(e)}


async def correct_with_session(
    session_id: str,
    instruction: str
) -> AsyncIterator[dict[str, Any]]:
    """
    Resume session for correction.

    Yields same event types as extract_with_agent.
    """
    options = ClaudeAgentOptions(
        resume=session_id,
        mcp_servers={"extraction": _extraction_server},
        allowed_tools=["mcp__extraction__save_extracted_data"],
        max_turns=3,
    )

    thinking_chunks: list[str] = []
    extraction_result: dict | None = None

    try:
        async with ClaudeSDKClient(options=options) as client:
            await client.query(instruction)

            async for message in client.receive_response():
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if isinstance(block, TextBlock):
                            thinking_chunks.append(block.text)
                            yield {"type": "thinking", "text": block.text}

                        elif isinstance(block, ToolUseBlock):
                            if block.name == "mcp__extraction__save_extracted_data":
                                extraction_result = block.input

        if extraction_result:
            yield {
                "type": "complete",
                "extraction": extraction_result,
                "session_id": session_id,  # Same session
                "thinking": "".join(thinking_chunks)
            }
        else:
            yield {"type": "error", "message": "No extraction result from correction"}

    except Exception as e:
        yield {"type": "error", "message": str(e)}
```

### 4.2 Service Checklist

- [x] `agent_extractor.py` created
- [x] Reuses prompts from existing `extractor.py`
- [x] Async generator yields streaming events
- [x] Session ID captured and returned
- [x] Error handling in place

---

## Phase 4 Findings (2024-12-18)

### Service Implementation

Created `backend/app/services/agent_extractor.py` with:

1. **`extract_with_agent(ocr_text, mode, custom_fields)`** - New extraction
2. **`correct_with_session(session_id, instruction)`** - Resume for corrections

### Streaming Events

The service yields three event types:

```python
{"type": "thinking", "text": "Claude's reasoning..."}
{"type": "complete", "extraction": {...}, "session_id": "uuid", "thinking": "..."}
{"type": "error", "message": "..."}
```

### Test Results

| Test | Result | Notes |
|------|--------|-------|
| Auto Mode | PASSED | 9 fields, 5 nested structures |
| Custom Mode | PASSED | Extracted exactly 4 requested fields |
| Session Correction | PASSED | Claude remembered context, applied correction |

### Key Implementation Details

1. **JSON String Handling**: Tool inputs may be JSON strings - added `_parse_extraction_input()` helper

2. **Session ID Capture**: Captured from `ResultMessage.session_id` after query completes

3. **Prompt Enhancement**: Added instruction to call tool after analysis:
   ```python
   prompt += "\n\nAfter analyzing the document, call the save_extracted_data tool..."
   ```

4. **MCP Server Singleton**: Server created once at module load, reused across calls

### Files Created

- `backend/app/services/agent_extractor.py` - Main service
- `backend/spikes/test_agent_extractor.py` - Test script

### Usage Example

```python
from app.services.agent_extractor import extract_with_agent, correct_with_session

# New extraction
async for event in extract_with_agent(ocr_text, "auto"):
    if event["type"] == "thinking":
        print(f"Claude: {event['text']}")
    elif event["type"] == "complete":
        save_to_db(event["extraction"], event["session_id"])

# Later: user correction
async for event in correct_with_session(session_id, "The total should be $3,000"):
    if event["type"] == "complete":
        update_extraction(event["extraction"])
```

---

## Phase 5: New Routes

**Goal**: Create `/api/agent/` routes that use the new service.

### 5.1 Create Agent Routes

Create `backend/app/routes/agent.py`:

```python
"""
Agent SDK routes - streaming extraction endpoints.

These run alongside existing /api/process and /api/re-extract.
"""

import json
from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from fastapi.responses import StreamingResponse

from ..services.agent_extractor import extract_with_agent, correct_with_session
from ..services.ocr import extract_text_ocr
from ..services.storage import upload_document, create_signed_url
from ..database import get_supabase

router = APIRouter(prefix="/api/agent", tags=["agent"])


@router.post("/process")
async def process_with_agent(
    file: UploadFile = File(...),
    mode: str = Form("auto"),
    user_id: str = Form(...),
    custom_fields: str | None = Form(None),
):
    """
    Process document with Agent SDK streaming.

    Returns SSE stream with thinking + extraction result.
    """
    # TODO: Implement full flow
    # For now, just test the extraction streaming

    async def event_stream():
        # Placeholder OCR text for testing
        ocr_text = "Test invoice content..."

        yield f"data: {json.dumps({'type': 'status', 'message': 'Starting extraction...'})}\n\n"

        fields = custom_fields.split(",") if custom_fields else None

        async for event in extract_with_agent(ocr_text, mode, fields):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream"
    )


@router.post("/correct")
async def correct_extraction(
    document_id: str = Form(...),
    user_id: str = Form(...),
    instruction: str = Form(...),
):
    """
    Correct extraction using session resume.
    """
    # TODO: Get session_id from database
    session_id = "placeholder"

    async def event_stream():
        async for event in correct_with_session(session_id, instruction):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream"
    )


@router.get("/health")
async def agent_health():
    """Check Agent SDK is working."""
    return {"status": "ok", "sdk": "claude-agent-sdk"}
```

### 5.2 Register Routes

Update `backend/app/main.py`:

```python
from .routes import process, agent  # Add agent

app.include_router(process.router)
app.include_router(agent.router)  # Add this line
```

### 5.3 Routes Checklist

- [x] `routes/agent.py` created
- [x] Routes registered in main.py
- [x] `/api/agent/health` returns OK
- [x] `/api/agent/extract` streams events with real extraction
- [x] Existing `/api/process` still works

---

## Phase 5 Findings (2024-12-18)

### Endpoints Created

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/agent/extract` | POST | Extract with SSE streaming (uses cached OCR) |
| `/api/agent/correct` | POST | Correct extraction with session resume |
| `/api/agent/health` | GET | Health check |

### SSE Event Format

```javascript
// Status update
data: {"type": "status", "message": "Starting extraction..."}

// Claude thinking (streamed in real-time)
data: {"type": "thinking", "text": "I'll analyze this document..."}

// Completion with saved extraction
data: {"type": "complete", "extraction_id": "uuid", "session_id": "uuid", "extracted_fields": {...}}

// Error
data: {"type": "error", "message": "..."}
```

### Database Integration

The routes already implement Phase 6 requirements:
- ✅ `session_id` stored in `extractions` table
- ✅ `session_id` stored in `documents` table for easy lookup
- ✅ Fetches `session_id` from DB for corrections
- ✅ Uses cached OCR from `ocr_results` table

### Frontend Usage

```javascript
// Extract with streaming
const response = await fetch('/api/agent/extract', {
  method: 'POST',
  body: formData  // document_id, user_id, mode, custom_fields
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const {value, done} = await reader.read();
  if (done) break;

  const lines = decoder.decode(value).split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const event = JSON.parse(line.slice(6));
      if (event.type === 'thinking') {
        // Display thinking in UI
      } else if (event.type === 'complete') {
        // Update extraction display
      }
    }
  }
}
```

### Files Modified

- `backend/app/routes/agent.py` - New routes file
- `backend/app/main.py` - Added agent router

---

## Phase 6: Integration

**Goal**: Wire up the full flow with OCR and database.

### Tasks

- [x] Save extraction + session_id to database (done in Phase 5)
- [x] Fetch session_id from DB for corrections (done in Phase 5)
- [ ] Add database migrations for `session_id` columns (if not already present)
- [ ] Add fallback for expired/missing sessions
- [ ] Full integration test with real document upload

---

## Phase 7: Frontend Integration

**Goal**: Frontend can use new streaming endpoints.

### Tasks

- [ ] Create `useAgentExtraction` hook
- [ ] Display streaming thinking
- [ ] Handle SSE connection drops
- [ ] Switch between old/new endpoints via feature flag

---

## File Structure (End State)

```
backend/app/
├── services/
│   ├── extractor.py           # Existing - unchanged
│   ├── agent_extractor.py     # New - Agent SDK
│   ├── ocr.py
│   └── storage.py
├── routes/
│   ├── process.py             # Existing - unchanged
│   └── agent.py               # New - streaming endpoints
└── main.py                    # Updated to include agent routes
```

---

## Rollback

Since existing code is untouched:

1. Remove `agent.py` route registration from `main.py`
2. Frontend switches back to `/api/process`
3. Done - no data migration needed

---

## Success Criteria

### Spike Phase
- [ ] SDK imports and runs
- [ ] Understand message structure
- [ ] Session resume works
- [ ] Tools work

### Service Phase
- [ ] Streaming extraction works
- [ ] Session ID captured
- [ ] Corrections work

### Integration Phase
- [ ] Full flow: upload → OCR → extract → save
- [ ] Corrections with real session resume
- [ ] Frontend displays thinking

---

## Notes

- **Don't rush**: Each phase should be working before moving to next
- **Console log everything**: Understand the SDK before abstracting
- **Keep old code**: Only remove after new code is proven in production

---

## Phase 1 Findings (2024-12-18)

### Actual SDK Message Structure

The Context7 docs were slightly wrong. Here's the real structure:

```python
# AssistantMessage
- content: list[TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock]
- model: str
- parent_tool_use_id: str | None
- error: Literal['authentication_failed', 'billing_error', ...] | None

# ResultMessage - THIS HAS SESSION_ID!
- session_id: str          # ← Key for resume!
- total_cost_usd: float | None
- usage: dict | None       # {input_tokens, output_tokens, cache_read_input_tokens, ...}
- duration_ms: int
- duration_api_ms: int
- num_turns: int
- is_error: bool
- result: str | None
- structured_output: Any

# SystemMessage (sent first, contains init data)
- subtype: str             # "init"
- data: dict               # Contains tools, mcp_servers, model, session_id, etc.

# UserMessage
- content: str | list[ContentBlock]
- uuid: str | None
- parent_tool_use_id: str | None
```

### Message Flow

1. `SystemMessage` (subtype="init") - Contains session_id, available tools, model
2. `AssistantMessage` - Claude's response with TextBlock content
3. `ResultMessage` - Final stats including session_id, cost, usage

### Key Discovery

- `session_id` is in BOTH `SystemMessage.data['session_id']` and `ResultMessage.session_id`
- Cost for simple extraction: ~$0.015
- Duration: ~6 seconds
- Model: claude-sonnet-4-5-20250929

### Code Corrections

- Use `anyio.run(main)` not `asyncio.run(main())`
- No `StreamEvent` type exists
- No `stop_reason` on AssistantMessage (only on ResultMessage indirectly via is_error)
- Spike tests moved to `backend/spikes/` folder
