# Stackdocs UI/UX Decisions

This document outlines the UI component library choices and UX patterns for the Stackdocs frontend.

---

## UI Component Library Decision

### Choice: shadcn/ui + TanStack Table

**Why shadcn/ui:**
- Tailwind-native (matches Next.js 14 + Tailwind stack)
- Copy-paste components - full ownership and customization
- Lightweight - only include what we use
- Strong Next.js ecosystem adoption
- No styling conflicts or overrides needed

**Why TanStack Table (for data tables):**
- Headless library - provides logic, we control styling
- Sorting, filtering, pagination built-in
- Row selection for bulk operations
- Column visibility toggles
- Handles dynamic columns (critical for variable extraction schemas)
- Expandable rows for nested data

**Alternatives Considered:**
| Library | Verdict |
|---------|---------|
| PrimeReact | Overkill - excellent DataTable but heavy bundle, enterprise features we don't need |
| HeroUI | Good but less ecosystem support than shadcn |

---

## Component Strategy

### What shadcn Provides

| Component | Use Case |
|-----------|----------|
| `Button` | Actions, submit, navigation |
| `Input` | Search, text fields, AI instruction input |
| `Card` | Document cards in grid view |
| `Table` | Base styling for TanStack Table |
| `DropdownMenu` | Row actions, column visibility |
| `Checkbox` | Row selection |
| `Badge` | Status indicators (processing/completed/failed) |
| `Dialog` | Confirmations (delete document) |
| `Tabs` | Mode selection (auto/custom) |

### TanStack Table Features to Use

- `getSortedRowModel()` - Sort by date, amount, vendor
- `getFilteredRowModel()` - Search/filter documents
- `getPaginationRowModel()` - Navigate large document sets
- `getExpandedRowModel()` - Inline expansion for nested data
- Row selection - Bulk export selected documents

---

## Data Display Pattern

### The Challenge

Extraction data is **dynamic** - different documents produce different schemas:

```json
// Invoice extraction
{ "vendor": "Acme", "amount": 1200, "line_items": [...] }

// Resume extraction
{ "name": "Jane", "skills": [...], "experience": [...] }
```

Columns cannot be hardcoded - they must be generated from the extraction data.

### Solution: Dynamic Columns + Inline Expansion

**Data types to handle:**
| Type | Example | Display |
|------|---------|---------|
| Scalar | `"vendor": "Acme Corp"` | Simple text cell |
| String array | `"notes": ["item1", "item2"]` | `[2 items]` → expand to bullet list |
| Nested object | `"primary_content": { title, definition }` | `{object}` → expand to key/value |
| Object array | `"line_items": [{ product, qty, price }]` | `[3 items]` → expand to sub-table |

**Inline expansion pattern:**
```
┌─────────────────────────────────────────────────────────────┐
│ Document │ Vendor    │ Amount  │ Line Items    │ Actions   │
├──────────┼───────────┼─────────┼───────────────┼───────────┤
│ inv_01   │ Acme Corp │ $1,200  │ ▼ [3 items]   │ ⋮         │
├──────────┴───────────┴─────────┴───────────────┴───────────┤
│  │ Product     │ Qty │ Price  │ Amount │                   │
│  │ Widget A    │  10 │ $50    │ $500   │   ← Expanded      │
│  │ Widget B    │   5 │ $100   │ $500   │     sub-table     │
│  │ Service Fee │   1 │ $200   │ $200   │                   │
└─────────────────────────────────────────────────────────────┘
```

**Why inline expansion:**
- Keeps context - see parent row and nested data together
- Can expand multiple rows to compare
- Familiar pattern (accordions, tree views)
- Excel/spreadsheet feel the user wants

---

## Editing Strategy (MVP)

### Decision: AI Re-extraction Over Manual Forms

**Instead of building:**
- Complex form inputs for each field
- Nested table editors with add/remove rows
- Side panel editing UI

**We build:**
- Simple text input for correction instructions
- AI re-extracts using cached OCR with user's instruction

**User flow:**
```
See wrong data → Type "Fix vendor to 'Acme Corporation'" → AI re-extracts → Done
```

**Why this approach:**
1. **Faster to build** - No complex form state management
2. **AI-first product** - Leans into core value prop
3. **Handles complexity** - "Remove the third line item" works without building delete UI
4. **Already built** - `/api/re-extract` endpoint exists, uses cached OCR (no extra cost)

**MVP UI:**
```
┌─────────────────────────────────────────────────────┐
│ invoice_001.pdf                      [Re-extract ▼] │
├─────────────────────────────────────────────────────┤
│ vendor          │ Acme Corp                         │
│ amount          │ $1,200                            │
│ line_items      │ ▼ [3 items]                       │
│   └─ (expanded sub-table)                           │
├─────────────────────────────────────────────────────┤
│ 💬 "Change vendor to 'Acme Corporation'"   [Submit] │
└─────────────────────────────────────────────────────┘
```

**Post-MVP consideration:** Add manual inline editing if users request it.

---

## Agentic Extraction with Claude Agent SDK

### The Vision

Users see Claude's thinking process in real-time as it analyzes their document. This builds trust, provides transparency, and differentiates Stackdocs from "black box" extraction tools.

**Key Feature: Session Persistence** - User corrections resume the same session. Claude remembers the document and previous extraction, enabling natural corrections like "Change the vendor to Acme Corp" without re-explaining context.

```
┌─────────────────────────────────────────────────────────────┐
│  Processing: invoice_001.pdf                                │
├─────────────────────────────────────────────────────────────┤
│  ✓ OCR Complete                                             │
│                                                             │
│  🧠 AI Analysis:                                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ This appears to be an invoice from Acme Corporation     ││
│  │ dated January 15, 2024.                                 ││
│  │                                                         ││
│  │ The document has a standard invoice layout:             ││
│  │ - Header with company logo and billing address          ││
│  │ - Invoice number: INV-2024-0847                         ││
│  │ - Line items table with 3 products                      ││
│  │                                                         ││
│  │ I can identify:                                         ││
│  │ • Vendor: Acme Corporation (clearly stated in header)   ││
│  │ • Total: $1,200 (sum of line items checks out ✓)        ││
│  │ • 3 line items with product, quantity, and price        ││
│  │                                                         ││
│  │ Extracting structured data...                           ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ✓ Extraction complete                                      │
├─────────────────────────────────────────────────────────────┤
│  💬 "Change vendor to 'Acme Corporation Inc'"    [Submit]   │
│  ↑ User can make corrections - Claude remembers context     │
└─────────────────────────────────────────────────────────────┘
```

### Technology: Claude Agent SDK

We use the **Claude Agent SDK** (`claude-agent-sdk`) instead of the raw Anthropic SDK. This gives us:

| Feature | Anthropic SDK | Agent SDK |
|---------|--------------|-----------|
| Session memory | Manual | Built-in |
| Conversation resume | Not supported | `resume=session_id` |
| Streaming | Manual delta handling | Automatic |
| Tool execution | You handle it | Agent handles it |
| Thinking output | Prompt engineering | Natural behavior |

### How It Works

```python
from claude_agent_sdk import query, ClaudeAgentOptions, tool, create_sdk_mcp_server

# 1. Define extraction tool
@tool("save_extracted_data", "Save structured extraction from document", {
    "extracted_fields": dict,
    "confidence_scores": dict
})
async def save_extraction(args: dict) -> dict:
    return {"content": [{"type": "text", "text": "Extraction saved"}]}

# 2. Create tool server
extraction_server = create_sdk_mcp_server(
    name="extraction-tools",
    tools=[save_extraction]
)

# 3. Run extraction - get session_id back
async def extract_document(ocr_text: str):
    session_id = None

    async for message in query(
        prompt=f"Analyze and extract data from:\n\n{ocr_text}",
        options=ClaudeAgentOptions(
            model="claude-haiku-4-5-20250514",
            mcp_servers={"extraction": extraction_server},
            allowed_tools=["mcp__extraction__save_extracted_data"],
        )
    ):
        # Capture session ID from first message
        if hasattr(message, 'subtype') and message.subtype == 'init':
            session_id = message.data.get('session_id')

        # Stream thinking + capture extraction
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    yield {"type": "thinking", "text": block.text}
                elif isinstance(block, ToolUseBlock):
                    yield {"type": "complete", "extraction": block.input, "session_id": session_id}


# 4. Resume session for corrections
async def correct_extraction(session_id: str, instruction: str):
    async for message in query(
        prompt=instruction,  # e.g., "Fix vendor to Acme Corp"
        options=ClaudeAgentOptions(
            resume=session_id  # Claude remembers everything!
        )
    ):
        # ... same handling
```

### Session Flow

```
INITIAL EXTRACTION:
┌──────────────────┐     ┌─────────────────────────────────────┐
│ POST /process    │────>│ Claude Agent SDK                    │
│ + OCR text       │     │ • Analyzes document                 │
│                  │     │ • Streams thinking                  │
│                  │     │ • Calls save_extracted_data tool    │
│                  │<────│ • Returns session_id: "abc-123"     │
└──────────────────┘     └─────────────────────────────────────┘
                                      ↓
                         Save session_id to documents table

USER CORRECTION:
┌──────────────────┐     ┌─────────────────────────────────────┐
│ POST /re-extract │────>│ Claude Agent SDK                    │
│ + session_id     │     │ resume="abc-123"                    │
│ + instruction    │     │                                     │
│                  │     │ Claude remembers:                   │
│                  │     │ • The original document             │
│                  │     │ • Its previous analysis             │
│                  │     │ • What it extracted                 │
│                  │     │                                     │
│                  │<────│ Applies correction, re-extracts     │
└──────────────────┘     └─────────────────────────────────────┘
```

### Database Schema Update

```sql
-- Add session tracking
ALTER TABLE documents ADD COLUMN session_id TEXT;
CREATE INDEX idx_documents_session_id ON documents(session_id);

ALTER TABLE extractions ADD COLUMN session_id TEXT;
```

### Streaming Architecture

```
Frontend                          Backend (FastAPI)
   │                                    │
   │  POST /api/process/stream          │
   │ ──────────────────────────────────>│
   │                                    │
   │                                    │  1. Run Mistral OCR
   │    SSE: {"type": "status",         │
   │          "message": "Running OCR"} │
   │ <──────────────────────────────────│
   │                                    │
   │                                    │  2. Claude Agent streams
   │    SSE: {"type": "thinking",       │
   │          "text": "This appears..."}│
   │ <──────────────────────────────────│
   │                                    │
   │    ... more thinking chunks ...    │
   │                                    │
   │                                    │  3. Agent calls tool
   │    SSE: {"type": "complete",       │
   │          "extraction": {...},      │
   │          "session_id": "abc-123"}  │  ← Session ID returned
   │ <──────────────────────────────────│
   │                                    │
   │  Connection closed                 │
   │                                    │
   │  POST /api/re-extract/stream       │  ← User makes correction
   │  + session_id + instruction        │
   │ ──────────────────────────────────>│
   │                                    │
   │    SSE: {"type": "thinking",       │  Claude resumes session
   │          "text": "I see, let me..."}
   │ <──────────────────────────────────│
   │                                    │
   │    SSE: {"type": "complete",       │
   │          "extraction": {...}}      │  Updated extraction
   │ <──────────────────────────────────│
   └────────────────────────────────────┘
```

### Frontend Implementation

```typescript
// hooks/useDocumentProcessing.ts
export function useDocumentProcessing() {
  const [thinking, setThinking] = useState<string>('')
  const [extraction, setExtraction] = useState<Extraction | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const processDocument = async (file: File, mode: string) => {
    setIsProcessing(true)
    setThinking('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('mode', mode)

    const response = await fetch(`${API_URL}/api/process/stream`, {
      method: 'POST',
      body: formData
    })

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n\n').filter(l => l.startsWith('data: '))

      for (const line of lines) {
        const data = JSON.parse(line.slice(6))

        switch (data.type) {
          case 'thinking':
            setThinking(prev => prev + data.text)
            break
          case 'complete':
            setExtraction(data.extraction)
            setSessionId(data.session_id)  // Store for corrections!
            setIsProcessing(false)
            break
        }
      }
    }
  }

  const correctExtraction = async (instruction: string) => {
    if (!sessionId) throw new Error('No session to resume')

    setIsProcessing(true)
    setThinking('')

    const response = await fetch(`${API_URL}/api/re-extract/stream`, {
      method: 'POST',
      body: new URLSearchParams({
        document_id: documentId,
        session_id: sessionId,
        instruction
      })
    })

    // Same streaming logic - Claude remembers context
    // ...
  }

  return { thinking, extraction, sessionId, isProcessing, processDocument, correctExtraction }
}
```

### Why Agent SDK Over Raw Anthropic SDK

| Benefit | Description |
|---------|-------------|
| **Session Memory** | User says "fix vendor" → Claude knows which document, what it extracted |
| **Natural Corrections** | "Remove line item 3" works without re-explaining the document |
| **Fork Sessions** | Can try different extraction approaches without losing original |
| **Like Claude Code** | Same SDK that powers Claude Code - proven agentic behavior |
| **Built-in Streaming** | No manual delta handling needed |

### Fallback: DB Persistence

Session data persists in:
1. Claude Agent SDK storage (`~/.claude/projects/`)
2. Our database (`documents.session_id`, `extractions.session_id`)

If SDK session expires (30 days), we fall back to stateless re-extraction using cached OCR text.

---

## View Layouts

### Document Library (Grid View)

Per PRD - card layout, not a data table:

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ [thumbnail]  │  │ [thumbnail]  │  │ [thumbnail]  │
│ invoice_01   │  │ receipt_02   │  │ contract_03  │
│ Acme Corp    │  │ Coffee Shop  │  │ ClientCo     │
│ $1,200       │  │ $4.50        │  │ —            │
│ ● Completed  │  │ ◐ Processing │  │ ● Completed  │
└──────────────┘  └──────────────┘  └──────────────┘
```

**Components:** shadcn `Card`, `Badge` for status

### Single Document View (Extraction Results)

Two-level display per PRD FR5:
- Scalar fields as label/value pairs
- Array/nested fields as expandable tables

### Stacks View (Future)

Aggregate extractions across multiple documents:

```
┌─────────────────────────────────────────────────────────────┐
│ [Search...] [Filter ▼] [Columns ▼]    [Export CSV] [JSON]  │
├──────────┬───────────┬─────────┬──────────┬────────────────┤
│ Document │ Vendor    │ Amount  │ Date     │ Line Items     │
├──────────┼───────────┼─────────┼──────────┼────────────────┤
│ ☐ inv_01 │ Acme Corp │ $1,200  │ Jan 15   │ ▶ [3 items]    │
│ ☑ inv_02 │ Widget Inc│ $450    │ Jan 18   │ ▶ [5 items]    │
│ ☐ inv_03 │ Acme Corp │ $800    │ Feb 01   │ ▶ [2 items]    │
└──────────┴───────────┴─────────┴──────────┴────────────────┘
│ 1 of 3 selected                     [Previous] [Next]      │
└─────────────────────────────────────────────────────────────┘
```

**Features needed:**
- Dynamic columns from combined extraction schemas
- Row selection for bulk export
- Sorting and filtering
- Pagination

---

## Technical Implementation Notes

### Dynamic Column Generation

```tsx
function generateColumns(data: Record<string, unknown>): ColumnDef<any>[] {
  return Object.keys(data).map((key) => ({
    accessorKey: key,
    header: formatHeader(key), // snake_case → Title Case
    cell: ({ row }) => {
      const value = row.getValue(key)

      if (Array.isArray(value)) {
        return <ExpandableArrayCell data={value} />
      }
      if (typeof value === 'object' && value !== null) {
        return <ExpandableObjectCell data={value} />
      }
      return <span>{String(value)}</span>
    },
  }))
}
```

### Expandable Rows with TanStack

```tsx
const table = useReactTable({
  data,
  columns,
  getExpandedRowModel: getExpandedRowModel(),
  getRowCanExpand: (row) => hasNestedData(row.original),
})

// In render:
{row.getIsExpanded() && (
  <TableRow>
    <TableCell colSpan={columns.length}>
      <NestedDataDisplay data={row.original} />
    </TableCell>
  </TableRow>
)}
```

---

## Dependencies to Install

```bash
# shadcn CLI (if not installed)
npx shadcn@latest init

# Core components
npx shadcn@latest add button input card table dropdown-menu checkbox badge dialog tabs

# TanStack Table
npm install @tanstack/react-table
```

---

## Summary

| Decision | Choice |
|----------|--------|
| Component library | shadcn/ui |
| Data table | TanStack Table |
| Nested data display | Inline expansion |
| Editing approach | AI re-extraction (not manual forms) |
| Document library | Card grid |
| Stacks view | TanStack Table with dynamic columns |
| **Extraction UX** | **Agentic streaming (text + tool use)** |
| **Processing feedback** | **Real-time AI thinking via SSE** |

---

## Implementation Priority

### Backend (Streaming Extraction)
1. Update `extractor.py`: Change `tool_choice` to `"auto"`
2. Update extraction prompts to require analysis before tool use
3. Create streaming extraction function with async generator
4. Add new SSE endpoint `POST /api/process/stream`
5. Ensure DB updates happen during stream for fallback

### Frontend (Processing UI)
1. Install shadcn components (Card, Badge, etc.)
2. Create `useDocumentProcessing` hook with EventSource
3. Build `ProcessingView` component with thinking display
4. Add typing animation/cursor for streaming text
5. Handle SSE errors and connection drops gracefully

### Integration
1. Wire up upload flow to use streaming endpoint
2. Test with various document types
3. Add fallback to non-streaming endpoint if needed

---

## Related Documents

- `planning/PRD.md` - Product requirements (FR5: two-level layout)
- `planning/ARCHITECTURE.md` - System design
- `planning/TASKS.md` - Implementation tasks

---

## Implementation Notes & Gotchas

### EventSource/POST Issue

`EventSource` only supports GET requests, but our streaming endpoint is `POST /api/process/stream`.

**Solution:** Use `fetch()` with streaming response instead of EventSource:

```typescript
// hooks/useDocumentProcessing.ts
const processDocument = async (documentId: string) => {
  setIsProcessing(true)
  setThinking('')

  const response = await fetch(`${API_URL}/api/process/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id: documentId })
  })

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    // SSE format: "data: {...}\n\n"
    const lines = chunk.split('\n\n').filter(line => line.startsWith('data: '))

    for (const line of lines) {
      const data = JSON.parse(line.slice(6)) // Remove "data: " prefix

      switch (data.type) {
        case 'status':
          setStatus(data.message)
          break
        case 'thinking':
          setThinking(prev => prev + data.text)
          break
        case 'complete':
          setExtraction(data.extraction)
          setIsProcessing(false)
          break
        case 'error':
          setError(data.message)
          setIsProcessing(false)
          break
      }
    }
  }
}
```

### Robust Error Recovery

SSE connections can drop (mobile networks, backgrounded tabs). Handle gracefully:

```typescript
// hooks/useDocumentProcessing.ts
const processDocument = async (documentId: string) => {
  try {
    // ... streaming code above ...
  } catch (error) {
    // Connection dropped mid-stream - check if extraction completed anyway
    console.error('Stream connection lost:', error)
    await checkDocumentStatus(documentId)
  }
}

const checkDocumentStatus = async (documentId: string) => {
  // Fallback: query Supabase directly
  const { data: doc } = await supabase
    .from('documents')
    .select('status')
    .eq('id', documentId)
    .single()

  if (doc?.status === 'completed') {
    // Extraction finished - fetch results
    const { data: extraction } = await supabase
      .from('extractions')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (extraction) {
      setExtraction(extraction.extracted_fields)
      setIsProcessing(false)
    }
  } else if (doc?.status === 'failed') {
    setError('Extraction failed')
    setIsProcessing(false)
  } else {
    // Still processing - subscribe to Realtime for updates
    subscribeToDocumentUpdates(documentId)
  }
}

const subscribeToDocumentUpdates = (documentId: string) => {
  supabase
    .channel(`document:${documentId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'documents',
      filter: `id=eq.${documentId}`
    }, (payload) => {
      if (payload.new.status === 'completed') {
        // Fetch extraction results
        fetchExtractionResults(documentId)
      } else if (payload.new.status === 'failed') {
        setError('Extraction failed')
        setIsProcessing(false)
      }
    })
    .subscribe()
}
```

### Prompt Reliability

Handle edge case where Claude skips text and goes straight to tool use:

```python
# Backend: extractor.py
async for event in stream:
    if hasattr(event, 'delta'):
        if event.delta.type == "text_delta":
            yield f"data: {json.dumps({'type': 'thinking', 'text': event.delta.text})}\n\n"
        elif event.delta.type == "input_json_delta":
            tool_input += event.delta.partial_json

# After stream ends
if tool_input:
    extraction = json.loads(tool_input)
    await save_extraction(doc_id, extraction)
    yield f"data: {json.dumps({'type': 'complete', 'extraction': extraction})}\n\n"
else:
    # Claude didn't use the tool - log for debugging
    logger.warning(f"Document {doc_id}: Claude did not call extraction tool")
    yield f"data: {json.dumps({'type': 'error', 'message': 'Extraction failed - no structured output'})}\n\n"
```
