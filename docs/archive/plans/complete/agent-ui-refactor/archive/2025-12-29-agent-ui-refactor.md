# Agent UI Refactor Plan

> **Status:** Ready for review
> **Created:** 2025-12-29
> **Prerequisite for:** Stacks feature (agent-first interaction model)

---

## Problem

Currently we have two separate UI systems for AI interactions:

| Component | Location | Purpose |
|-----------|----------|---------|
| `AiChatBar` + `AiActivityPanel` | `layout/` | Document corrections |
| `UploadDialogContent` (modal) | `layout/upload-dialog/` | Upload wizard with extraction |

Both use the same streaming pattern but have completely separate containers. The Stacks design requires an "AI-first" interaction model with a unified **dynamic chat bar** that handles all agent workflows.

---

## Solution

Consolidate into **one agent system**:

```
┌─────────────────────────────────────────┐
│           Agent Popup Window            │
│                                         │
│  Renders one of:                        │
│  • UploadFlow (dropzone → config)       │
│  • CreateStackFlow (future)             │
│  • CreateTableFlow (future)             │
│  • ActivityLog (streaming events)       │
│  • CompletionSummary                    │
│  • ConfirmationPrompt                   │
│                                         │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ ⬡  How can I help you today?        [↑] │  ← Always visible
└─────────────────────────────────────────┘
```

---

## Component Structure

```
components/agent/
├── agent-provider.tsx         # Global context: popup state, status, events
├── agent-bar.tsx              # Persistent input bar at bottom
├── agent-popup.tsx            # Window container (chrome: chevron, close, confirm)
│
├── flows/                     # Multi-step workflows
│   └── upload-flow.tsx        # Dropzone → Configure → Fields → Extracting
│
├── panels/                    # Single-state panels
│   ├── activity-log.tsx       # Streaming events with checkmarks
│   ├── completion.tsx         # "Done!" + action buttons
│   └── confirm-close.tsx      # "Are you sure?" when closing mid-flow
│
└── index.ts                   # Barrel export
```

---

## MVP Scope

### In Scope

| Feature | Description |
|---------|-------------|
| AgentProvider | Global context for popup state, streaming status, events |
| AgentBar | Persistent input bar (same as current, moved to new location) |
| AgentPopup | Unified popup container with collapse/close chrome |
| UploadFlow | Upload wizard moved into popup (dropzone → configure → fields) |
| ActivityLog | Streaming events display (current `AiActivityPanel` logic) |
| Completion panel | "Done!" summary with action buttons |
| Close confirmation | Alert when user tries to close mid-flow |
| Upload button trigger | Opens popup directly with UploadFlow |

### Out of Scope (Future)

- Drag-drop file upload trigger
- State persistence if popup closed mid-flow
- CreateStackFlow
- CreateTableFlow
- Chat history / conversation memory

---

## AgentProvider State

```typescript
interface AgentState {
  // Popup
  isOpen: boolean
  content: 'upload' | 'activity' | 'completion' | null

  // Flow state (for multi-step flows)
  flowStep: string | null

  // Streaming
  status: 'idle' | 'streaming' | 'complete' | 'error'
  events: AgentEvent[]
  error: string | null

  // Context (what we're working on)
  context: {
    documentId?: string
    stackId?: string
  }
}

interface AgentActions {
  openUpload: () => void
  openActivity: (context: { documentId: string }) => void
  close: () => void
  submit: (message: string) => void
  reset: () => void
}
```

---

## Implementation Tasks

### Phase 1: Create agent folder structure

1. Create `components/agent/` directory
2. Create `agent-provider.tsx` with context and state
3. Create `agent-bar.tsx` (migrate from `ai-chat-bar.tsx`)
4. Create `agent-popup.tsx` (container with chrome)
5. Create barrel export `index.ts`

### Phase 2: Migrate activity panel

1. Create `panels/activity-log.tsx` (migrate from `ai-activity-panel.tsx`)
2. Create `panels/completion.tsx` (extract from activity panel)
3. Wire up to AgentProvider

### Phase 3: Migrate upload flow

1. Create `flows/upload-flow.tsx` (migrate from `upload-dialog-content.tsx`)
2. Move step components: `dropzone-step.tsx`, `configure-step.tsx`, `fields-step.tsx`
3. Move supporting components: `extraction-progress.tsx`, `upload-status.tsx`, etc.
4. Wire upload button to open popup with UploadFlow

### Phase 4: Close confirmation

1. Create `panels/confirm-close.tsx`
2. Add logic to show confirmation when closing mid-flow
3. Handle cancel vs confirm actions

### Phase 5: Cleanup

1. Remove old `layout/ai-chat-bar.tsx`
2. Remove old `layout/ai-activity-panel.tsx`
3. Remove old `layout/upload-dialog/` folder
4. Update layout imports
5. Update any pages using old components

---

## File Changes Summary

### New Files
- `components/agent/agent-provider.tsx`
- `components/agent/agent-bar.tsx`
- `components/agent/agent-popup.tsx`
- `components/agent/flows/upload-flow.tsx`
- `components/agent/panels/activity-log.tsx`
- `components/agent/panels/completion.tsx`
- `components/agent/panels/confirm-close.tsx`
- `components/agent/index.ts`

### Moved Files
- `layout/upload-dialog/steps/*` → `components/agent/flows/upload-steps/`
- `layout/upload-dialog/extraction-progress.tsx` → `components/agent/panels/`
- `layout/upload-dialog/*.tsx` (supporting) → `components/agent/flows/`

### Deleted Files
- `components/layout/ai-chat-bar.tsx`
- `components/layout/ai-activity-panel.tsx`
- `components/layout/upload-dialog/` (entire folder)

### Modified Files
- `app/(app)/layout.tsx` - Use new AgentProvider and AgentBar
- `components/layout/page-header.tsx` - Update upload button to use agent context

---

## Success Criteria

- [ ] Upload button opens popup with upload flow (not a modal)
- [ ] Upload flow works: dropzone → configure → fields → extract
- [ ] Document corrections work via chat bar input
- [ ] Activity log shows streaming events during extraction
- [ ] Completion panel shows "Done!" with action buttons
- [ ] Close button shows confirmation when mid-flow
- [ ] Chevron collapses popup without losing state
- [ ] No regressions in existing upload/extraction functionality

---

## Open Questions

1. **Bar status text**: When uploading, should the bar show "Uploading invoice.pdf..." or stay as placeholder?
2. **Multiple contexts**: If user starts upload, then navigates to a document and tries to chat — what happens? (Probably: block with "Upload in progress")
3. **Keyboard shortcuts**: Should Escape close the popup? Show confirmation?

---

## References

- Design doc: `2025-12-29-stacks-design-v2.md`
- Current chat bar: `components/layout/ai-chat-bar.tsx`
- Current upload dialog: `components/layout/upload-dialog/`
- Agent streaming hook: `hooks/use-agent-stream.ts`
