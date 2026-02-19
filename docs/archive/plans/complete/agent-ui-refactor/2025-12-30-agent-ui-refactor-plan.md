# Agent UI Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate fragmented AI UI (chat bar, upload dialog, activity panel) into a unified "Dynamic Island" style agent system with a morphing chat bar and contextual popup.

**Scope:** Frontend only. Replaces existing upload dialog and chat bar components.

**Architecture:**
- Zustand store with discriminated unions for type-safe flow routing
- AgentContainer lives in root layout (`app/(app)/layout.tsx`) - app-wide availability
- AgentContainer self-manages visibility via `usePathname()` (shows on `/documents`, `/stacks`)
- AgentBar renders status dynamically based on state
- AgentPopup appears above bar when flow is active
- Context awareness via route + existing contexts (no unified context store)
- Session persistence handled by backend (Claude SDK + database `session_id`)

**Tech Stack:** Zustand, shadcn/ui, Tabler Icons, existing agent-api.ts (SSE streaming)

---

## Status: Phase 3 Partial

Phase 1 (Foundation), Phase 2 (Upload Flow), and Phase 3 Tasks 3.1-3.2 complete. E2E testing (3.3) started but paused for UI tweaks. Phase 4 (Cleanup) pending.

---

## Plan Structure

| File | Description | Status |
|------|-------------|--------|
| [01-foundation.md](./01-foundation.md) | Zustand store, AgentBar, AgentActions, AgentPopup, barrel exports | ✅ Complete |
| [02-upload-flow.md](./02-upload-flow.md) | UploadFlow component, step components, popup wiring | ✅ Complete |
| [03-integration.md](./03-integration.md) | Wire into root layout (app-wide), header upload button, E2E testing | 🔄 Partial (3.1-3.2 done, 3.3 in progress) |
| [04-cleanup.md](./04-cleanup.md) | Delete old components, update exports, final verification | Pending |
| [testing-checklist.md](./testing-checklist.md) | E2E testing checklist for manual verification | New |

---

## Implementation Order

### Phase 1: Foundation (01-foundation.md)
1. Create Agent Store (Zustand with discriminated unions)
2. Create AgentBar (morphing status bar)
3. Create AgentActions (contextual action buttons)
4. Create AgentPopup (floating popup above bar)
5. Create barrel exports

### Phase 2: Upload Flow (02-upload-flow.md)
1. Create UploadFlow component (step router)
2. Create step components (dropzone, configure, fields, extracting, complete)
3. Wire popup content routing
4. Add close confirmation dialog

### Phase 3: Integration (03-integration.md)
1. Add AgentContainer to root layout (app-wide, self-managed visibility)
2. Remove old aiChatBarContent from documents layout and context
3. Add Upload button to header actions
4. End-to-end flow testing

### Phase 4: Cleanup (04-cleanup.md)
1. Remove old upload dialog components
2. Update barrel exports
3. Final verification and build

---

## Design Document

See [2025-12-30-agent-ui-refactor-v2.md](./2025-12-30-agent-ui-refactor-v2.md) for full design rationale.

---

## Success Criteria

- [ ] Upload button in header opens agent popup (not modal)
- [ ] Dropzone → Configure → Processing → Complete flow works
- [ ] User can rename document in configure step
- [ ] Bar shows dynamic status during upload/extraction
- [ ] Popup auto-collapses during processing
- [ ] Actions appear on bar focus, hidden otherwise
- [ ] Actions change based on current route
- [ ] Close mid-flow shows confirmation dialog
- [ ] No regressions in upload/extraction functionality
- [ ] Old upload dialog components deleted
- [ ] Build passes with no TypeScript errors
