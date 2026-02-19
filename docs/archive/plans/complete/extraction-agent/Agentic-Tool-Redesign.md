# Extraction Agent Redesign

> **Status:** Planning
> **Created:** 2024-12-18
> **Location:** `planning/agent-sdk/extraction-agent-redesign/`

---

## Problem Statement

The current Agent SDK implementation uses tools as an **output format hack** rather than as **real actions**. This is not how agentic systems should work.

### Current Implementation Issues

```python
# Current "tool" - does nothing, just returns acknowledgment
@tool("save_extracted_data", "Save extracted data", {"extracted_fields": dict, "confidence_scores": dict})
async def extraction_tool(args: dict) -> dict:
    return {"content": [{"type": "text", "text": "Extraction saved successfully"}]}
```

**Problems:**

1. **Tool is a dummy** - Returns a static message, performs no action
2. **Data captured via interception** - We intercept `ToolUseBlock.input` instead of the tool doing work
3. **No validation** - Tool doesn't check if data is valid
4. **No error recovery** - Agent can't retry on bad data
5. **All logic in prompts** - Prompts do 100% of the work, tool does 0%
6. **OCR text in prompt** - Stuffing OCR into prompt instead of agent reading it
7. **TextBlock misused** - Code treats `TextBlock` as "thinking" (wrong - it's user-facing response)

### Current Flow (Wrong)

```
Prompt with OCR text stuffed in
       ↓
Claude "thinks" and generates extraction
       ↓
Claude calls save_extracted_data (tool does nothing)
       ↓
We intercept tool input to get data
       ↓
Done (agent's final text is ignored)
```

This treats Claude as a **structured output generator**, not an **agent**.

---

## Correct Agentic Workflow

An agent should work like Claude Code:

1. **User gives task** - "Extract data from this document"
2. **Agent reads data** - Uses tools to fetch what it needs
3. **Agent acts via tools** - Tools perform real DB operations with validation
4. **Agent summarizes** - Tells user what was accomplished

### Data Flow

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   ocr_results   │  READ   │     Agent       │  WRITE  │   extractions   │
│                 │────────▶│                 │────────▶│                 │
│  (Mistral OCR)  │         │  (Claude SDK)   │         │  (structured)   │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

The agent bridges `ocr_results` → `extractions` using real database operations.

---

## Architecture Decision: Direct DB Writes

**Decision:** Tools write directly to the database, not to in-memory session state.

### Why Direct DB Writes

| Aspect | In-Memory State | Direct DB Writes |
|--------|-----------------|------------------|
| Crash recovery | Lost if crash | Progress saved per tool |
| Complexity | Shared state to manage | Each tool self-contained |
| Observability | Can't see progress | Progress visible in DB |
| Stacks (future) | Risky for long operations | Each document row saved |
| Agent mental model | Must understand session | Just CRUD operations |

### Flow with Direct DB Writes

```
┌─────────────────────────────────────────────────────────────────┐
│                         Agent Workflow                          │
│                                                                 │
│  1. Start extraction                                            │
│     → INSERT into extractions (status='in_progress')            │
│                                                                 │
│  2. get_document_text()                                         │
│     → SELECT from ocr_results                                   │
│                                                                 │
│  3. extract_fields({...})                                       │
│     → UPDATE extractions SET extracted_fields = {...}           │
│                                                                 │
│  4. update_field(path="document.title", value="New")            │
│     → UPDATE extractions using jsonb_set()                      │
│                                                                 │
│  5. complete_extraction()                                       │
│     → UPDATE extractions SET status='completed'                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tool Security: Multi-Tenant Scoping

Tools are **scoped to the current user and document**. The agent cannot access other users' data.

### How Scoping Works

```python
# Agent CANNOT specify user_id or document_id
# They're injected at tool creation time - agent is locked to this scope

def create_tools(extraction_id: str, document_id: str, user_id: str, db: Client):

    @tool("get_document_text", "Read the document text", {})
    async def get_document_text(args: dict) -> dict:
        # Scoped queries - agent can't override
        result = db.table("ocr_results") \
            .select("raw_text") \
            .eq("document_id", document_id) \  # Locked
            .eq("user_id", user_id) \          # Locked
            .single() \
            .execute()

        return {"content": [{"type": "text", "text": result.data["raw_text"]}]}

    return [get_document_text, ...]
```

**Agent's view:** `get_document_text` with no parameters
**Reality:** Query scoped to `user_id` + `document_id` automatically

---

## New Tool Design

### Read Tools

| Tool | Source Table | Purpose |
|------|--------------|---------|
| `get_document_text` | `ocr_results` | Read OCR text to extract from |
| `get_current_extraction` | `extractions` | See current extraction state |

### Write Tools

| Tool | Target Table | Purpose |
|------|--------------|---------|
| `identify_document` | `extractions` | Set document type |
| `extract_fields` | `extractions` | Write extracted fields |
| `update_field` | `extractions` | Update field at JSON path |
| `remove_field` | `extractions` | Remove field at JSON path |
| `complete_extraction` | `extractions` | Set status='completed' |

---

## Tool Implementations

### Tool 1: `get_document_text` (READ)

```python
@tool("get_document_text", "Read the document text for extraction", {})
async def get_document_text(args: dict) -> dict:
    result = db.table("ocr_results") \
        .select("raw_text, page_count") \
        .eq("document_id", document_id) \
        .eq("user_id", user_id) \
        .single() \
        .execute()

    if not result.data:
        return {
            "content": [{"type": "text", "text": "No OCR data found for this document"}],
            "is_error": True
        }

    return {
        "content": [{
            "type": "text",
            "text": f"Document ({result.data['page_count']} pages):\n\n{result.data['raw_text']}"
        }]
    }
```

### Tool 2: `get_current_extraction` (READ)

```python
@tool("get_current_extraction", "View the current extraction state", {})
async def get_current_extraction(args: dict) -> dict:
    result = db.table("extractions") \
        .select("extracted_fields, confidence_scores, status") \
        .eq("id", extraction_id) \
        .single() \
        .execute()

    return {
        "content": [{"type": "text", "text": json.dumps(result.data, indent=2)}]
    }
```

### Tool 3: `extract_fields` (WRITE)

```python
@tool(
    "extract_fields",
    "Extract fields from the document. Saves directly to database.",
    {"fields": dict, "confidences": dict}
)
async def extract_fields(args: dict) -> dict:
    fields = args.get("fields", {})
    confidences = args.get("confidences", {})

    # Validation
    errors = validate_extraction(fields, confidences)
    if errors:
        return {
            "content": [{"type": "text", "text": "Validation failed:\n- " + "\n- ".join(errors)}],
            "is_error": True
        }

    # Direct DB write
    db.table("extractions").update({
        "extracted_fields": fields,
        "confidence_scores": confidences,
        "updated_at": "now()"
    }).eq("id", extraction_id).eq("user_id", user_id).execute()

    return {
        "content": [{"type": "text", "text": f"Saved {len(fields)} fields to database"}]
    }
```

### Tool 4: `update_field` (WRITE - JSON Path)

```python
@tool(
    "update_field",
    "Update a specific field using JSON path (e.g., 'document.title' or 'items[2].price')",
    {"path": str, "value": Any, "confidence": float}
)
async def update_field(args: dict) -> dict:
    path = args["path"]
    value = args["value"]
    confidence = args["confidence"]

    # Validate confidence
    if not 0 <= confidence <= 1:
        return {
            "content": [{"type": "text", "text": f"Confidence must be 0.0-1.0, got {confidence}"}],
            "is_error": True
        }

    # Convert path to Postgres array format
    # "document.title" → '{document,title}'
    # "items[2].price" → '{items,2,price}'
    pg_path = parse_json_path(path)

    # Use Postgres jsonb_set for surgical update
    db.rpc("update_extraction_field", {
        "p_extraction_id": extraction_id,
        "p_user_id": user_id,
        "p_field_path": pg_path,
        "p_value": json.dumps(value),
        "p_confidence": confidence
    }).execute()

    return {
        "content": [{"type": "text", "text": f"Updated '{path}' = {value} (confidence: {confidence})"}]
    }
```

**Postgres function for path updates:**

```sql
CREATE OR REPLACE FUNCTION update_extraction_field(
    p_extraction_id UUID,
    p_user_id UUID,
    p_field_path TEXT[],
    p_value JSONB,
    p_confidence FLOAT
) RETURNS VOID AS $$
BEGIN
    UPDATE extractions
    SET
        extracted_fields = jsonb_set(extracted_fields, p_field_path, p_value),
        confidence_scores = jsonb_set(confidence_scores, p_field_path, to_jsonb(p_confidence)),
        updated_at = NOW()
    WHERE id = p_extraction_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;
```

### Tool 5: `remove_field` (WRITE - JSON Path)

```python
@tool(
    "remove_field",
    "Remove a field using JSON path",
    {"path": str}
)
async def remove_field(args: dict) -> dict:
    path = args["path"]
    pg_path = parse_json_path(path)

    db.rpc("remove_extraction_field", {
        "p_extraction_id": extraction_id,
        "p_user_id": user_id,
        "p_field_path": pg_path
    }).execute()

    return {
        "content": [{"type": "text", "text": f"Removed field at '{path}'"}]
    }
```

### Tool 6: `complete_extraction` (WRITE)

```python
@tool("complete_extraction", "Mark extraction as complete", {})
async def complete_extraction(args: dict) -> dict:
    # Validate before completing
    current = db.table("extractions") \
        .select("extracted_fields, confidence_scores") \
        .eq("id", extraction_id) \
        .single() \
        .execute()

    if not current.data.get("extracted_fields"):
        return {
            "content": [{"type": "text", "text": "Cannot complete: no fields extracted"}],
            "is_error": True
        }

    # Mark complete
    db.table("extractions").update({
        "status": "completed",
        "updated_at": "now()"
    }).eq("id", extraction_id).eq("user_id", user_id).execute()

    field_count = len(current.data["extracted_fields"])
    return {
        "content": [{"type": "text", "text": f"Extraction complete. {field_count} fields saved."}]
    }
```

---

## Message Types & SSE Streaming

### SDK Message Types

```python
from claude_agent_sdk import (
    AssistantMessage,  # Claude's responses
    ResultMessage,     # Final message with cost/usage
)

# Content block types in AssistantMessage:
TextBlock      # Claude's text output (user-facing response)
ThinkingBlock  # Claude's internal reasoning (extended thinking, if enabled)
ToolUseBlock   # Tool calls with name and input
```

**Important:** `TextBlock` is Claude's actual response - NOT "thinking".

### Simplified SSE Events

No custom type enums. Just flat objects:

```python
async for message in client.receive_response():
    if isinstance(message, AssistantMessage):
        for block in message.content:
            if isinstance(block, TextBlock):
                yield sse_event({"text": block.text})
            elif isinstance(block, ToolUseBlock):
                yield sse_event({"tool": block.name, "input": block.input})

    elif isinstance(message, ResultMessage):
        yield sse_event({
            "complete": True,
            "extraction_id": extraction_id,
            "cost": message.total_cost_usd
        })
```

**Frontend checks what keys exist:**
- `{text}` → Show Claude's response
- `{tool}` → Show tool activity
- `{complete}` → Extraction finished

---

## Agent System Prompt

```python
EXTRACTION_SYSTEM_PROMPT = """You are an expert document data extraction agent.

## Available Tools

**Read:**
- `get_document_text` - Read the OCR text from the document
- `get_current_extraction` - View what's been extracted so far

**Write:**
- `extract_fields` - Save extracted fields and confidence scores
- `update_field` - Update a specific field (supports nested paths like 'vendor.name')
- `remove_field` - Remove an incorrectly extracted field
- `complete_extraction` - Mark extraction as complete

## Workflow

1. Use `get_document_text` to read the document
2. Analyze the content and identify the document type
3. Use `extract_fields` to save your extraction
4. Use `complete_extraction` when done
5. Summarize what you extracted for the user

## Guidelines

- Extract ALL relevant fields using rich nested structures
- Assign honest confidence scores (0.0-1.0)
- Only extract data explicitly present - don't guess
- Use appropriate types (numbers for amounts, arrays for lists)

## For Corrections

When the user provides corrections:
1. Use `get_current_extraction` to see current state
2. Use `update_field` with the path to fix specific fields (e.g., 'document.title')
3. Use `remove_field` if something shouldn't be there
4. Summarize what you changed

Always end by summarizing what you extracted or changed.
"""
```

---

## Folder Structure

```
backend/app/
├── agents/                              # Agent-specific code
│   ├── __init__.py
│   └── extraction_agent/                # Extraction agent
│       ├── __init__.py
│       ├── agent.py                     # Main agent (extract_with_agent, correct_with_session)
│       ├── prompts.py                   # System prompts
│       └── tools/                       # Tools for this agent
│           ├── __init__.py
│           ├── get_document_text.py     # READ from ocr_results
│           ├── get_current_extraction.py # READ from extractions
│           ├── extract_fields.py        # WRITE to extractions
│           ├── update_field.py          # WRITE with jsonb_set
│           ├── remove_field.py          # WRITE with jsonb remove
│           └── complete_extraction.py   # WRITE status
│
├── services/                            # Non-agent services
│   ├── extractor.py                     # Original extractor (fallback)
│   ├── agent_extractor.py               # OLD - delete after migration
│   └── ocr.py
│
└── routes/
    ├── agent.py                         # Agent routes
    └── process.py                       # Original routes
```

**Note:** Removed `session.py` - no longer needed with direct DB writes.

---

## Implementation Plan

### Phase 1: Database Setup
- [ ] Create Postgres function `update_extraction_field` for jsonb_set
- [ ] Create Postgres function `remove_extraction_field` for jsonb remove
- [ ] Add `status` column to extractions if not exists

### Phase 2: Tool Implementation
- [ ] Implement `get_document_text` (read from ocr_results)
- [ ] Implement `get_current_extraction` (read from extractions)
- [ ] Implement `extract_fields` (write to extractions)
- [ ] Implement `update_field` (jsonb_set with path parsing)
- [ ] Implement `remove_field` (jsonb remove)
- [ ] Implement `complete_extraction` (status update)
- [ ] Create tool factory with scoped context injection

### Phase 3: Agent Integration
- [ ] Update `agent.py` to create extraction record first
- [ ] Create tools with scoped context
- [ ] Simplify streaming (use SDK types directly)
- [ ] Remove old session state code

### Phase 4: Route Updates
- [ ] Update `/api/agent/extract` to create extraction then run agent
- [ ] Update `/api/agent/correct` to load extraction and run agent
- [ ] Simplify SSE events

### Phase 5: Cleanup
- [ ] Delete `services/agent_extractor.py`
- [ ] Delete `session.py`
- [ ] Update tests

---

## Future: Stacks Agent

When building the stacks agent, keep these patterns in mind:

### Stacks Data Model

```
stacks
  └── stack_documents (many docs)
        └── documents → ocr_results
  └── stack_tables
        └── stack_table_rows (one row per doc)
```

### Stacks Agent Tools

| Tool | Operation | Tables |
|------|-----------|--------|
| `list_documents` | READ | stack_documents, documents |
| `get_document_text(doc_id)` | READ | ocr_results |
| `define_columns` | WRITE | stack_tables |
| `extract_row(doc_id)` | WRITE | stack_table_rows |
| `update_cell(doc_id, column)` | WRITE | stack_table_rows (jsonb_set) |
| `get_table_state` | READ | stack_tables, stack_table_rows |
| `complete_table` | WRITE | stack_tables |

### Stacks Scoping

```python
# Tools scoped to stack_id + user_id
def create_stack_tools(stack_id: str, user_id: str, db: Client):

    @tool("list_documents", "List all documents in this stack", {})
    async def list_documents(args: dict) -> dict:
        # Can only see documents in THIS stack
        result = db.table("stack_documents") \
            .select("document_id, documents(filename)") \
            .eq("stack_id", stack_id) \
            .execute()
        ...
```

### Key Difference from Single Doc

- Agent works with **multiple documents**
- Need to track which document each row comes from
- Schema inference across documents
- Direct DB writes even more important (long-running)

---

## Resolved Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| State management | Direct DB writes | Simpler, crash recovery, observable |
| Path updates | JSON path with Postgres jsonb_set | Surgical updates for nested data |
| SSE format | Flat objects, no type field | Simple, frontend checks keys |
| Tool scoping | Inject context at creation | Multi-tenant security |
| OCR in prompt | No - agent reads via tool | Cleaner prompts, more agentic |
| TextBlock handling | User-facing response | Was wrongly treated as "thinking" |

---

## References

- Current (old) implementation: `backend/app/services/agent_extractor.py`
- Route handlers: `backend/app/routes/agent.py`
- New agent location: `backend/app/agents/extraction_agent/`
- Claude Agent SDK docs: https://docs.anthropic.com/en/docs/agents-and-tools/claude-agent-sdk
