# Agents

**Purpose:** AI agents using Claude Agent SDK for document data extraction with scoped database tools.

## Structure

```
agents/
├── extraction_agent/       # Single document extraction
│   ├── agent.py            # extract_with_agent(), correct_with_session()
│   ├── prompts.py          # EXTRACTION_SYSTEM_PROMPT, CORRECTION_PROMPT_TEMPLATE
│   └── tools/              # Scoped database tools
└── stack_agent/            # Multi-document batch extraction (WIP)
    ├── agent.py            # extract_stack(), update_stack()
    ├── prompts.py          # STACK_SYSTEM_PROMPT, UPDATE_PROMPT_TEMPLATE
    └── tools/              # Table/row management tools
```

## Data Flow

```
API Request → Create Extraction Record → Create Scoped Tools → Run Agent → SSE Stream
                                              ↓
                                    Agent uses tools to:
                                    1. read_ocr (get document text)
                                    2. save_extraction (write JSONB)
                                    3. complete (mark done)
```

## Tool Factory Pattern (Security-Critical)

Tools use factory functions that capture request context at creation time:

```python
def create_read_ocr_tool(document_id: str, user_id: str, db: Client):
    @tool("read_ocr", "Read OCR text", {})
    async def read_ocr(args: dict) -> dict:
        # All queries locked to document_id/user_id - agent cannot override
        result = db.table("ocr_results").eq("document_id", document_id).eq("user_id", user_id)...
    return read_ocr
```

## extraction_agent Tools

| Tool | Type | Purpose |
|------|------|---------|
| `read_ocr` | READ | Fetch cached OCR text from `ocr_results` |
| `read_extraction` | READ | View current extracted fields |
| `save_extraction` | WRITE | Write full extraction (fields + confidences) |
| `set_field` | WRITE | Update field at JSON path (e.g., `vendor.name`) |
| `delete_field` | WRITE | Remove field at JSON path |
| `complete` | WRITE | Mark extraction + document as completed |

## stack_agent Tools

| Tool | Type | Purpose |
|------|------|---------|
| `read_documents` | READ | List documents in stack |
| `read_ocr` | READ | Fetch OCR text for specific document |
| `read_tables` | READ | Read table definitions |
| `create_table` | WRITE | Create new table in `stack_tables` |
| `add_column` | WRITE | Add column to table schema |
| `set_column` | WRITE | Modify column definition |
| `delete_column` | WRITE | Remove column from table |
| `read_rows` | READ | Read existing rows |
| `create_row` | WRITE | Insert row in `stack_table_rows` |
| `set_row_field` | WRITE | Update value at JSON path |
| `delete_row_field` | WRITE | Remove field from row |
| `complete` | WRITE | Mark stack extraction complete |

## Triggered By

- `POST /api/agent/extract` - Runs `extract_with_agent()` with SSE streaming
- `POST /api/agent/correct` - Runs `correct_with_session()` with session resume

## Key Patterns

- **MCP Server**: Tools registered via `create_sdk_mcp_server(name="extraction", tools=tools)`
- **SSE Streaming**: Agent events yielded as `{"text": ...}`, `{"tool": ...}`, `{"complete": ...}`
- **Session Resume**: `correct_with_session()` uses `ClaudeAgentOptions(resume=session_id)`
- **Tool Response Format**: Return `{"content": [{"type": "text", "text": "..."}]}` or `{"is_error": True}`
