# Agent UI Refactor - Design v2

> **Status:** Ready for implementation
> **Created:** 2025-12-30
> **Supersedes:** 2025-12-29-agent-ui-refactor.md

---

## Vision

A "Dynamic Island" style agent UI where the chat bar morphs based on state and serves as the primary interaction surface. All dialogs and flows appear in a popup above the bar, creating a unified agent system.

**Core principle:** Agent-first, but not gimmicky. Explicit action buttons for control, dynamic bar for feedback.

---

## Problem

Current state has fragmented UI for AI interactions:

| Component | Location | Issue |
|-----------|----------|-------|
| `AiChatBar` + `AiActivityPanel` | `layout/` | Static bar, separate activity popup |
| Upload Dialog | `layout/upload-dialog/` | Modal dialog, disconnected from agent |

Users interact with AI through scattered touchpoints. No unified mental model.

---

## Solution

Consolidate into one agent system with a dynamic chat bar and contextual popup:

```
┌───────────────────────────────────────────────────────────────┐
│  [ Popup: flows, forms, completion actions ]           ∧   ✕  │
└───────────────────────────────────────────────────────────────┘
┌───────────────────────────────────────────────────────────────┐
│  ↻  Dynamic status text...                                 ↑  │
└───────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

```
components/agent/
├── stores/
│   └── agent-store.ts        # Zustand store
├── agent-bar.tsx             # Dynamic chat bar
├── agent-popup.tsx           # Popup container (chrome + content)
├── agent-actions.tsx         # Context-aware action buttons
│
├── flows/
│   ├── documents/
│   │   └── upload-flow.tsx   # Dropzone → Configure → Extracting
│   ├── stacks/
│   │   ├── create-stack-flow.tsx
│   │   └── add-documents-flow.tsx
│   └── tables/
│       ├── create-table-flow.tsx
│       └── manage-columns-flow.tsx
│
├── panels/
│   └── confirm-close.tsx     # "Cancel upload?" confirmation
│
└── index.ts                  # Barrel export
```

---

## State Management

**Zustand store with discriminated union for type-safe flow routing:**

```typescript
// stores/agent-store.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

type AgentFlow =
  // Document flows
  | { type: 'upload'; step: 'dropzone' | 'configure' | 'extracting'; data?: UploadFlowData }
  | { type: 'extract-document'; documentId: string }

  // Stack flows
  | { type: 'create-stack' }
  | { type: 'edit-stack'; stackId: string }
  | { type: 'add-documents'; stackId: string }

  // Table flows
  | { type: 'create-table'; stackId: string }
  | { type: 'manage-columns'; stackId: string; tableId: string }
  | { type: 'extract-table'; stackId: string; tableId: string }

  | null

interface UploadFlowData {
  file?: File
  documentName?: string
  extractionMethod?: 'auto' | 'custom'
  customFields?: string[]
}

interface AgentEvent {
  id: string
  type: 'text' | 'tool' | 'complete' | 'error'
  content: string
  timestamp: number
}

interface AgentStore {
  // Popup state
  flow: AgentFlow
  isExpanded: boolean  // Actions visible
  isPopupOpen: boolean // Popup visible

  // Dynamic bar state
  status: 'idle' | 'processing' | 'waiting' | 'complete' | 'error'
  statusText: string

  // SSE events (capped at 100)
  events: AgentEvent[]

  // Actions
  openFlow: (flow: AgentFlow) => void
  setStep: (step: string) => void
  updateFlowData: (data: Partial<UploadFlowData>) => void
  setStatus: (status: AgentStore['status'], text: string) => void
  addEvent: (event: AgentEvent) => void
  setExpanded: (expanded: boolean) => void
  collapsePopup: () => void
  expandPopup: () => void
  close: () => void
  reset: () => void
}

export const useAgentStore = create<AgentStore>()(
  devtools(
    (set) => ({
      flow: null,
      isExpanded: false,
      isPopupOpen: false,
      status: 'idle',
      statusText: 'How can I help you today?',
      events: [],

      openFlow: (flow) => set({ flow, isPopupOpen: true, status: 'idle' }),

      setStep: (step) => set((state) => ({
        flow: state.flow ? { ...state.flow, step } : null
      })),

      updateFlowData: (data) => set((state) => ({
        flow: state.flow ? { ...state.flow, data: { ...state.flow.data, ...data } } : null
      })),

      setStatus: (status, statusText) => set({ status, statusText }),

      addEvent: (event) => set((state) => ({
        events: [...state.events, event].slice(-100) // Cap at 100
      })),

      setExpanded: (isExpanded) => set({ isExpanded }),

      collapsePopup: () => set({ isPopupOpen: false }),

      expandPopup: () => set({ isPopupOpen: true }),

      close: () => set({
        flow: null,
        isPopupOpen: false,
        status: 'idle',
        statusText: 'How can I help you today?'
      }),

      reset: () => set({
        flow: null,
        isPopupOpen: false,
        isExpanded: false,
        status: 'idle',
        statusText: 'How can I help you today?',
        events: []
      }),
    }),
    { name: 'AgentStore' }
  )
)

// Selector helpers (prevent unnecessary re-renders)
export const useAgentFlow = () => useAgentStore((s) => s.flow)
export const useAgentStatus = () => useAgentStore((s) => ({ status: s.status, statusText: s.statusText }))
export const useAgentPopup = () => useAgentStore((s) => ({ isPopupOpen: s.isPopupOpen, isExpanded: s.isExpanded }))
```

---

## Dynamic Chat Bar States

The bar morphs based on current state (like iPhone Dynamic Island):

### Idle (default)
```
┌───────────────────────────────────────────────────────────────┐
│  ⬡  How can I help you today?                             ↑  │
└───────────────────────────────────────────────────────────────┘
• Input enabled
• Click/focus reveals action buttons
• Placeholder text shown
```

### Expanded (focused)
```
┌───────────────────────────────────────────────────────────────┐
│  [📤 Upload] [📚 Create Stack]                                │
│                                                               │
│  ⬡  Type a message...                                     ↑  │
└───────────────────────────────────────────────────────────────┘
• Action buttons appear above input (same container, no divider)
• Uses existing ActionButton component style
• Actions are context-aware based on route
```

### Processing
```
┌───────────────────────────────────────────────────────────────┐
│  ↻  Uploading document...                                  ↑  │
└───────────────────────────────────────────────────────────────┘
• Spinner icon
• Dynamic text updates via SSE
• Input disabled
• Text cycles: "Uploading..." → "Extracting text..." → "Analyzing..."
```

### Waiting (agent asking)
```
┌───────────────────────────────────────────────────────────────┐
│  ?  What would you like to change?                         ↑  │
└───────────────────────────────────────────────────────────────┘
• Question mark icon
• Agent's question as placeholder
• Input enabled for user response
```

### Complete
```
┌───────────────────────────────────────────────────────────────┐
│  ✓  Extraction complete                                    ↑  │
└───────────────────────────────────────────────────────────────┘
• Checkmark icon
• Success message
• Returns to idle after 3s or user interaction
```

### Error
```
┌───────────────────────────────────────────────────────────────┐
│  ✕  Something went wrong                                   ↑  │
└───────────────────────────────────────────────────────────────┘
• X icon (red)
• Error message
• Click to expand popup for details/retry
```

---

## Context-Aware Actions

Actions change based on current route:

| Route | Actions |
|-------|---------|
| `/documents` | Upload Document, Create Stack |
| `/documents/[id]` | Re-extract, Add to Stack |
| `/stacks` | Create Stack, Upload Document |
| `/stacks/[id]` | Add Documents, Create Table |
| `/stacks/[id]?tab=table` | Run Extraction, Manage Columns |

```typescript
// agent-actions.tsx
const ACTION_CONFIG: Record<string, ActionDef[]> = {
  '/documents': [
    { id: 'upload', label: 'Upload', icon: Upload, flow: { type: 'upload', step: 'dropzone' } },
    { id: 'create-stack', label: 'Create Stack', icon: Stack, flow: { type: 'create-stack' } },
  ],
  '/documents/[id]': [
    { id: 're-extract', label: 'Re-extract', icon: Refresh, flow: { type: 'extract-document' } },
    { id: 'add-to-stack', label: 'Add to Stack', icon: Plus, flow: { type: 'add-to-stack' } },
  ],
  // ...
}
```

---

## Popup Container

Popup appears above chat bar when flow is active. Same width as bar (max 640px).

**Chrome:**
- `∧` (chevron): Collapse popup, keep flow active
- `✕` (close): Close flow (with confirmation if mid-flow)

**Content slot:** Renders the active flow component based on `flow.type`

```typescript
// agent-popup.tsx
function AgentPopupContent() {
  const flow = useAgentFlow()

  switch (flow?.type) {
    case 'upload':
      return <UploadFlow />
    case 'create-stack':
      return <CreateStackFlow />
    case 'add-documents':
      return <AddDocumentsFlow stackId={flow.stackId} />
    // ...
    default:
      return null
  }
}
```

---

## Upload Flow Walkthrough

### Step 1: Trigger
User clicks "Upload" action button
→ `openFlow({ type: 'upload', step: 'dropzone' })`

### Step 2: Dropzone
```
┌───────────────────────────────────────────────────────────────┐
│  Upload Document                                       ∧   ✕  │
│                                                               │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│  │              📤                                       │  │
│  │    Drop a file here, or click to browse               │  │
│  │    PDF, JPG, PNG up to 10MB                           │  │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
└───────────────────────────────────────────────────────────────┘
┌───────────────────────────────────────────────────────────────┐
│  ⬡  Drop a file to get started                            ↑  │
└───────────────────────────────────────────────────────────────┘
```

### Step 3: Configure (after file drop)
```
┌───────────────────────────────────────────────────────────────┐
│  ‹  Configure Extraction                               ∧   ✕  │
│                                                               │
│  Document Name                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ invoice-march.pdf                                       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  Extraction Method                                            │
│  ┌─────────────────────┐  ┌─────────────────────┐            │
│  │ ● Auto Extract      │  │ ○ Custom Fields     │            │
│  └─────────────────────┘  └─────────────────────┘            │
│                                                               │
│                                           [Extract →]         │
└───────────────────────────────────────────────────────────────┘
┌───────────────────────────────────────────────────────────────┐
│  ⬡  Configure extraction settings                          ↑  │
└───────────────────────────────────────────────────────────────┘
```

### Step 4: Processing (auto-collapse)
User clicks "Extract" → popup auto-collapses, bar shows progress:

```
┌───────────────────────────────────────────────────────────────┐
│  ↻  Uploading document...                                  ↑  │
└───────────────────────────────────────────────────────────────┘
         ↓ (SSE updates)
┌───────────────────────────────────────────────────────────────┐
│  ↻  Extracting text from document...                       ↑  │
└───────────────────────────────────────────────────────────────┘
         ↓
┌───────────────────────────────────────────────────────────────┐
│  ↻  Analyzing document structure...                        ↑  │
└───────────────────────────────────────────────────────────────┘
         ↓
┌───────────────────────────────────────────────────────────────┐
│  ✓  Extraction complete                                    ↑  │
└───────────────────────────────────────────────────────────────┘
```

### Step 5: Complete (expand for actions)
User clicks ↑ to expand:

```
┌───────────────────────────────────────────────────────────────┐
│                                                        ∧   ✕  │
│  ✓ Successfully extracted 12 fields from invoice-march.pdf   │
│                                                               │
│  [View Document]                              [Upload Another] │
└───────────────────────────────────────────────────────────────┘
┌───────────────────────────────────────────────────────────────┐
│  ✓  Extraction complete                                    ↑  │
└───────────────────────────────────────────────────────────────┘
```

---

## Close & Cancel Behavior

| State | Close (✕) behavior |
|-------|---------------------|
| Dropzone (no file) | Close immediately |
| File selected / configuring | Show confirm dialog |
| Processing | Show confirm + abort request |
| Complete | Close immediately, reset |

**Confirm dialog:**
```
┌───────────────────────────────────────────────────────────────┐
│  Cancel Upload?                                        ∧   ✕  │
│                                                               │
│  You have an upload in progress. Are you sure you want        │
│  to cancel?                                                   │
│                                                               │
│                              [Continue Upload]    [Cancel]    │
└───────────────────────────────────────────────────────────────┘
```

---

## MVP Scope

### In Scope

**Components:**
- `agent-store.ts` - Zustand store
- `agent-bar.tsx` - Dynamic chat bar
- `agent-popup.tsx` - Popup container
- `agent-actions.tsx` - Context-aware buttons

**Features:**
- All bar states (idle, processing, waiting, complete, error)
- Upload flow (dropzone → configure with rename → auto-collapse → complete)
- Context-aware actions by route
- Close confirmation mid-flow
- SSE streaming status updates

### Out of Scope (Future)

| Feature | Reason |
|---------|--------|
| Natural language triggers | Requires intent detection |
| Create Stack flow | Build after upload works |
| Add Documents flow | Build after upload works |
| Create/Manage Table flows | Build after upload works |
| Drag-drop anywhere to upload | Nice-to-have |
| Draft persistence (localStorage) | Only if users lose data |
| Activity log panel | Bar status sufficient for MVP |

---

## Migration Plan

**Phase 1: Foundation**
1. Create `components/agent/` folder structure
2. Implement Zustand store with selectors
3. Build `agent-bar.tsx` with all states
4. Build `agent-popup.tsx` container

**Phase 2: Upload Flow**
1. Create `flows/documents/upload-flow.tsx`
2. Migrate existing step components (dropzone, configure)
3. Add document rename field
4. Implement auto-collapse on extract

**Phase 3: Integration**
1. Wire upload button in header to `openFlow()`
2. Implement context-aware actions
3. Test full upload flow end-to-end

**Phase 4: Cleanup**
1. Remove old `upload-dialog/` components
2. Remove old `ai-chat-bar.tsx` and `ai-activity-panel.tsx`
3. Update layout imports

---

## Success Criteria

- [ ] Upload button opens agent popup (not modal)
- [ ] Dropzone → Configure → Processing → Complete flow works
- [ ] User can rename document in configure step
- [ ] Bar shows dynamic status during upload/extraction
- [ ] Popup auto-collapses during processing
- [ ] Actions appear on bar focus, hidden otherwise
- [ ] Actions change based on current route
- [ ] Close mid-flow shows confirmation dialog
- [ ] No regressions in upload/extraction functionality

---

## Technical Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| State management | Zustand | Better than Context for frequent updates (SSE), selector optimization, no provider wrapper |
| Flow routing | Discriminated unions | Type-safe, explicit, each flow carries required context |
| Popup width | Match chat bar (max 640px) | Visual unity, Dynamic Island metaphor |
| Processing UI | Auto-collapse popup, status in bar | Clean, focused, bar is the "island" |
| Event storage | Zustand with 100 cap | Persist across popup collapse, prevent memory issues |

---

## References

- Existing chat bar: `components/layout/ai-chat-bar.tsx`
- Existing upload dialog: `components/layout/upload-dialog/`
- ActionButton style: `components/layout/action-button.tsx`
- Agent streaming hook: `hooks/use-agent-stream.ts`
