# Extraction Agent - Design

> **Status:** Backend Complete (Agentic tools implemented, Frontend pending)
> **Created:** 2025-12-18
> **Updated:** 2025-12-22

---

## Goal

Agentic document extraction using Claude Agent SDK, enabling:
- Session-based extraction with memory
- User corrections via session resume
- Real-time streaming of Claude's reasoning
- Tools perform real database operations

---

## Current State

### What's Implemented

| Component | Location | Status |
|-----------|----------|--------|
| Extraction Agent | `backend/app/agents/extraction_agent/` | Working |
| Agentic Tools (6) | `backend/app/agents/extraction_agent/tools/` | Working |
| SSE Streaming Routes | `backend/app/routes/agent.py` | Working |
| Session Resume | Via ClaudeAgentOptions.resume | Working |
| Status Column | `extractions.status` | Migrated |
| RPC Functions | `update_extraction_field`, `remove_extraction_field` | Migrated |

### API Endpoints

#### Current Endpoints (to be deprecated)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/agent/extract` | Extract with streaming (uses cached OCR) |
| `POST /api/agent/correct` | Correct extraction with session resume |
| `GET /api/agent/health` | Health check |

#### Proposed Endpoints (aligned with agents)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/document/extract` | Trigger extraction_agent (SSE streaming) |
| `POST /api/document/update` | Update extraction via session resume |

### How It Works

```
┌─────────────────┐     ┌────────────────────────┐     ┌──────────────────┐
│  Frontend       │     │  agent_extractor.py    │     │  Claude Agent    │
│  (not built)    │────▶│  ClaudeSDKClient       │────▶│  SDK             │
│                 │ SSE │  + extraction_tool     │     │                  │
│                 │◀────│                        │◀────│                  │
└─────────────────┘     └────────────────────────┘     └──────────────────┘
```

1. Route receives request with document_id
2. Fetches cached OCR from database
3. Calls `extract_with_agent()` with OCR text
4. Streams thinking events via SSE
5. Captures extraction from tool call
6. Saves to database with session_id

### Streaming Event Format

```json
{"type": "status", "message": "Starting extraction..."}
{"type": "thinking", "text": "This appears to be an invoice..."}
{"type": "complete", "extraction_id": "uuid", "session_id": "uuid", "extracted_fields": {...}}
{"type": "error", "message": "..."}
```

---

## Architecture Decisions

### Current Approach: Dummy Tool

The extraction tool captures Claude's structured output via `ToolUseBlock.input`:

```python
@tool("save_extracted_data", "Save extracted data", {"extracted_fields": dict})
async def extraction_tool(args: dict) -> dict:
    return {"content": [{"type": "text", "text": "Extraction saved"}]}
```

**Trade-offs:**
- Simple and working
- Tool doesn't do real work (just acknowledgment)
- Data captured via interception, not tool execution

### Agentic Tool Approach (In Progress)

A proper agentic architecture where tools perform real database operations:

| Tool | Operation |
|------|-----------|
| `read_ocr` | READ from ocr_results |
| `read_extraction` | READ from extractions |
| `save_extraction` | WRITE to extractions |
| `set_field` | WRITE with jsonb_set |
| `delete_field` | DELETE from JSONB |
| `complete` | WRITE status to documents |

**Benefits:** More robust, crash recovery, observable progress

**Status:** Tool stubs exist at `backend/app/agents/extraction_agent/tools/` with proper naming convention. Implementation pending.

---

## What's Not Built Yet

### Backend Gaps

- Session fallback handling (expired/missing sessions)
- Full integration testing with real documents
- Agentic tool implementation (optional refactor)

### Frontend (Phase 7)

- `useAgentExtraction` hook for SSE streaming
- Processing view with thinking display
- Correction input with session resume
- Connection drop recovery via Supabase fallback

---

## UI/UX Patterns

### Component Library: shadcn/ui + TanStack Table

Chosen for Tailwind-native styling and lightweight bundle.

### Streaming UI

```
┌─────────────────────────────────────────────────────────────┐
│  Processing: invoice_001.pdf                                │
├─────────────────────────────────────────────────────────────┤
│  ✓ OCR Complete                                             │
│                                                             │
│  AI Analysis:                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ This appears to be an invoice from Acme Corporation     ││
│  │ dated January 15, 2024...                               ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ✓ Extraction complete                                      │
├─────────────────────────────────────────────────────────────┤
│  "Change vendor to 'Acme Corporation Inc'"    [Submit]      │
└─────────────────────────────────────────────────────────────┘
```

### Editing Strategy: AI Re-extraction

Instead of complex form editors, users type natural language corrections:
- "Fix vendor to 'Acme Corporation'"
- "The total should be $1,500"
- "Remove line item 3"

Session resume means Claude remembers context.

---

## Database Schema

```sql
-- Session tracking columns (already added)
documents.session_id TEXT          -- For correction resume
extractions.session_id TEXT        -- Audit trail
extractions.is_correction BOOLEAN  -- Flag correction records
extractions.processing_time_ms INT -- Performance tracking
```

---

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/services/agent_extractor.py` | Core extraction logic (current) |
| `backend/app/routes/agent.py` | SSE streaming endpoints (to be deprecated) |
| `backend/app/agents/extraction_agent/` | Agentic tools (stubs ready for implementation) |
| `backend/app/agents/extraction_agent/tools/` | Tool implementations: read_ocr, read_extraction, save_extraction, set_field, delete_field, complete |
| `backend/spikes/` | SDK spike test scripts |

---

## References

- [Claude Agent SDK Docs](https://docs.anthropic.com/en/docs/agents-and-tools/claude-agent-sdk)
- Archived planning docs in `archive/` subfolder
