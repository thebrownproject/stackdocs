# Extraction Agent

**Purpose:** Agentic document data extraction using Claude Agent SDK with scoped database tools.

## Files

| File | Description |
|------|-------------|
| `agent.py` | Main agent logic: `extract_with_agent()` and `correct_with_session()` |
| `prompts.py` | System prompts for extraction and correction workflows |
| `__init__.py` | Public exports for the agent module |

### tools/

| File | Description |
|------|-------------|
| `__init__.py` | Tool factory: `create_tools()` scopes all tools to extraction context |
| `read_ocr.py` | Read OCR text from `ocr_results` table |
| `read_extraction.py` | Read current extraction state from `extractions` table |
| `save_extraction.py` | Write full extraction with fields and confidence scores |
| `set_field.py` | Update value at JSON path (e.g., `vendor.name`, `items[0].price`) |
| `delete_field.py` | Remove field at JSON path |
| `complete.py` | Mark extraction complete, update document status |

## Data Flow

1. Route creates extraction record, calls `extract_with_agent()`
2. Agent receives task prompt (auto or custom fields)
3. Agent uses `read_ocr` to get document text
4. Agent analyzes content, calls `save_extraction` with fields + confidences
5. Agent calls `complete` to finalize
6. Events stream via SSE: `{"text": "..."}`, `{"tool": "...", "input": {...}}`, `{"complete": true}`

For corrections: `correct_with_session()` resumes session with user instruction.

## Key Patterns

- **Tool Factory Pattern**: `create_tools(extraction_id, document_id, user_id, db)` scopes all database access. Agent cannot override IDs - multi-tenant security enforced.
- **MCP Server**: Tools registered via `create_sdk_mcp_server()`, prefixed as `mcp__extraction__*`
- **JSON Path Parsing**: `parse_json_path()` converts dot/bracket notation to Postgres array format
- **Postgres RPC**: `set_field` and `delete_field` use `update_extraction_field` and `remove_extraction_field` RPCs

## Usage

**Triggered by:** `POST /api/agent/extract` (see `routes/agent.py`)

**Modes:**
- `mode="auto"` - Extract all relevant fields
- `mode="custom"` - Extract specific fields (pass `custom_fields` list)

**Database writes:**
- `extractions.extracted_fields` (JSONB) - Nested field structure
- `extractions.confidence_scores` (JSONB) - Per-field confidence 0.0-1.0
- `extractions.status` - `in_progress` | `completed` | `failed`
- `documents.status` - Updated to `completed` on success
