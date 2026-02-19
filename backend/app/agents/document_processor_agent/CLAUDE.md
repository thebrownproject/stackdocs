# Document Processor Agent

**Purpose:** Generate document metadata (display_name, tags, summary) from OCR text using Claude Agent SDK.

## Files

| File | Description |
|------|-------------|
| `agent.py` | Main agent logic: `process_document_metadata()` |
| `prompts.py` | System prompt for metadata generation |
| `__init__.py` | Public exports for the agent module |

### tools/

| File | Description |
|------|-------------|
| `__init__.py` | Tool factory: `create_tools()` scopes tools to document context |
| `read_ocr.py` | Read OCR text from `ocr_results` table |
| `save_metadata.py` | Write metadata to `documents` table |

## Data Flow

1. Route validates document has OCR, calls `process_document_metadata()`
2. Agent uses `read_ocr` to get document text
3. Agent analyzes content and generates metadata
4. Agent calls `save_metadata` to write to database
5. Events stream via SSE: `{"text": "..."}`, `{"tool": "..."}`, `{"complete": true}`

## Key Patterns

- **Tool Factory Pattern**: `create_tools(document_id, user_id, db)` scopes all database access
- **MCP Server**: Tools registered as `mcp__metadata__*`
- **Lightweight**: Only 2 tools, 3 max turns - fast execution

## Triggered By

`POST /api/document/metadata` (see `routes/document.py`)

## Output Schema

The agent writes to `documents` table:
- `display_name` (TEXT): Descriptive filename
- `tags` (TEXT[]): 3-10 searchable tags
- `summary` (TEXT): 1-2 sentence description
