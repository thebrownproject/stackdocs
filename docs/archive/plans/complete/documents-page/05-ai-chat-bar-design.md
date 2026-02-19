# AI Chat Bar & Activity Panel Design

**Date:** 2025-12-23
**Feature:** Real-time AI chat interface for document corrections
**Location:** Document detail page (`/documents/[id]`)

---

## Overview

Add a chat bar at the bottom of the document detail page that allows users to ask the AI agent to correct or refine extracted data. When the user submits a message, an activity panel expands above the chat bar showing real-time agent activity via SSE streaming.

**Design inspiration:** Linear - extreme restraint, monochrome, Geist fonts, subtle motion.

---

## Components

### File Structure

```
frontend/
├── components/documents/
│   ├── ai-chat-bar.tsx          # Chat input + activity panel container
│   └── ai-activity-panel.tsx    # Collapsible panel with streaming events
├── hooks/
│   └── use-agent-stream.ts      # SSE streaming hook
└── lib/
    └── agent-api.ts             # API helper for agent endpoints
```

### Component Hierarchy

```
<AiChatBar>
  <AiActivityPanel />     ← Expands upward when streaming
  <form>                  ← Chat input
    <Textarea />
  </form>
</AiChatBar>
```

---

## Visual Design

### Chat Bar (Idle State)

```
┌─────────────────────────────────────────────────────────────┐
│  Ask AI to correct or refine extraction...                  │
└─────────────────────────────────────────────────────────────┘
```

**Styling:**
- Container: `border border-border rounded-lg px-3 py-2.5 bg-background`
- Focus: `ring-2 ring-ring/20 border-foreground/20`
- Placeholder: `text-sm text-muted-foreground`
- No icons, no visible submit button
- Enter to submit, Shift+Enter for newline

### Activity Panel (Expanded)

```
┌─────────────────────────────────────────────────────────────┐
│  ✓ Update complete                              ˅    ×     │
├─────────────────────────────────────────────────────────────┤
│  ✓  Reading current extraction                             │
│  ✓  Analyzing vendor field                                 │
│  ✓  Updating 3 records                                     │
│                                                             │
│  •  I see the 'Vendor' column has inconsistent naming.     │
│  •  I'll standardize those to 'Acme Corp Inc' for you.     │
│  •  All done. Updated 3 rows in the extraction.            │
└─────────────────────────────────────────────────────────────┘
```

**Styling:**
| Element | Classes |
|---------|---------|
| Panel | `bg-background border border-border rounded-xl shadow-lg` |
| Header | `px-4 py-3 flex items-center justify-between` |
| Status icon | Green `CheckCircle2` (size-4) when complete, `Loader2 animate-spin` when streaming |
| Title | `text-sm font-medium` - "Processing..." → "Update complete" |
| Chevron | `ChevronDown size-4 text-muted-foreground` rotates 180deg on collapse |
| Close | `X size-4 text-muted-foreground hover:text-foreground` |
| Tool items | `text-sm text-muted-foreground` with green `Check size-3.5` prefix |
| Text items | `text-sm text-foreground` with `•` prefix in muted |
| Content | `px-4 pb-4 space-y-1.5 max-h-64 overflow-y-auto` |

### Activity Panel (Collapsed)

```
┌─────────────────────────────────────────────────────────────┐
│  ✓ Update complete                              ˄    ×     │
└─────────────────────────────────────────────────────────────┘
```

Just the header row, content hidden.

---

## State Machine

```
idle ──submit()──> streaming ──{complete}──> complete ──3s──> collapsed
  ↑                    │                        │                 │
  └────reset()─────────┴────────────────────────┴─────reset()─────┘
                       │
                   {error}──> error
```

**States:**
- `idle` - No activity, panel hidden
- `streaming` - Receiving SSE events, panel expanded
- `complete` - Stream finished successfully, panel expanded
- `collapsed` - Auto-collapsed after 3s, can re-expand
- `error` - Stream failed, shows error message

---

## Hook API: useAgentStream

```typescript
interface AgentEvent {
  type: 'tool' | 'text'
  content: string
  timestamp: number
}

interface UseAgentStreamReturn {
  status: 'idle' | 'streaming' | 'complete' | 'error'
  events: AgentEvent[]
  error: string | null
  submit: (instruction: string) => void
  reset: () => void
}

function useAgentStream(documentId: string): UseAgentStreamReturn
```

### Implementation Notes

**SSE via fetch + ReadableStream** (not EventSource, since backend uses POST):

```typescript
const response = await fetch(`${API_URL}/api/agent/correct`, {
  method: 'POST',
  body: formData,  // document_id, instruction
})

const reader = response.body!.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  const text = decoder.decode(value)
  // Parse SSE format: "data: {...}\n\n"
  const lines = text.split('\n\n')
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const json = JSON.parse(line.slice(6))
      // Handle event...
    }
  }
}
```

**Tool name humanization:**
- `mcp__extraction__read_ocr` → "Reading OCR"
- `mcp__extraction__save_extraction` → "Saving extraction"
- `mcp__extraction__set_field` → "Updating field"

---

## Behavior

### Submit Flow

1. User types message, presses Enter
2. `submit(instruction)` called
3. Status → `streaming`, panel expands
4. Events stream in, rendered as they arrive
5. On `{ complete: true }`:
   - Status → `complete`
   - Title changes to "Update complete"
   - Start 3s auto-collapse timer
6. After 3s, panel collapses (header only visible)
7. User can re-expand by clicking header

### Error Handling

- On `{ error: "..." }`: Status → `error`, show error in panel
- On network failure: Status → `error`, show "Connection failed"
- User can dismiss and retry

### Panel Interactions

- Click header → toggle expand/collapse
- Click × → reset to idle (hides panel)
- Collapse disabled while streaming

---

## Layout

**Fixed to viewport bottom, centered:**

```tsx
// In document detail page
<div className="fixed bottom-0 inset-x-0 p-4 pointer-events-none">
  <div className="mx-auto max-w-2xl pointer-events-auto">
    <AiChatBar documentId={document.id} />
  </div>
</div>

{/* Spacer to prevent content overlap */}
<div className="h-20" />
```

---

## Animations

All transitions use `duration-150` for Linear's instant feel:

| Animation | Implementation |
|-----------|----------------|
| Panel expand/collapse | Radix Collapsible with CSS height transition |
| New event items | `animate-in fade-in duration-150` |
| Checkmark appear | `animate-in zoom-in-75 duration-150` |
| Chevron rotation | `transition-transform duration-150 rotate-180` |
| Spinner | `animate-spin` (Tailwind default) |

---

## Backend Integration

**Endpoint:** `POST /api/agent/correct`

**Request (FormData):**
- `document_id`: string
- `instruction`: string

**Response (SSE stream):**
```
data: {"tool": "mcp__extraction__read_extraction", "input": {...}}

data: {"text": "I see the issue with the vendor field..."}

data: {"tool": "mcp__extraction__set_field", "input": {"path": "vendor", "value": "Acme Corp"}}

data: {"text": "All done. I've updated the vendor name."}

data: {"complete": true, "extraction_id": "...", "session_id": "..."}
```

**Auth:** Clerk JWT in Authorization header (handled by existing auth setup)

---

## Dependencies

**New packages:** None required

**Shadcn components to install:**
- `collapsible` - For expand/collapse animation
- `textarea` - For auto-growing input (if not already installed)

```bash
npx shadcn@latest add collapsible textarea
```

---

## Accessibility

- Chat input has proper `aria-label`
- Panel has `role="region"` with `aria-live="polite"` for streaming updates
- Expand/collapse button has `aria-expanded` state
- Close button has `aria-label="Close activity panel"`
- Focus trapped in input during streaming (prevents accidental navigation)

---

## Open Questions (Resolved)

1. **SSE vs fetch streaming?** → fetch + ReadableStream (backend uses POST)
2. **Panel position?** → Fixed to viewport bottom, expands upward
3. **Auto-collapse timing?** → 3 seconds after completion
4. **Event mapping?** → `{ tool }` → checkmarks, `{ text }` → bullets
