# Agent Bar Redesign - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the agent bar into a unified card with Config + Hook Hybrid architecture supporting 8 flow types.

**Architecture:** Config + Hook Hybrid pattern separating static metadata (icons, status text, components) from dynamic logic (navigation, side effects, prop computation). Each flow type has a `metadata.ts` file and a `use-[flow]-flow.ts` hook. The unified card (`AgentCard`) combines these to render any flow with consistent chrome.

**Tech Stack:**
- Motion (framer-motion successor) for spring animations
- Zustand for state management (existing)
- shadcn/ui Collapsible for expand/collapse (existing)
- Custom click-outside hook

---

## Plan Overview

| Phase | Description | Effort | Status |
|-------|-------------|--------|--------|
| [Phase 1](./phase-1-infrastructure.md) | Flow types, registry, base card infrastructure | 1 day | ✅ Complete |
| [Phase 2](./phase-2-unified-card.md) | AgentCard, StatusBar, animations, click-outside | 1 day | ✅ Complete |
| [Phase 3](./phase-3-upload-migration.md) | Migrate existing upload flow to new pattern | 0.5 day | ✅ Complete |
| [Phase 4](./phase-4-remaining-flows.md) | Stub out remaining 7 flow types | 0.5 day | Pending |

**Total Effort:** ~3 days

---

## Architecture Summary

### File Structure (After)

```
frontend/components/agent/
├── card/                          # Unified card components
│   ├── agent-card.tsx             # Main card orchestrator
│   ├── agent-status-bar.tsx       # Morphing status bar
│   ├── agent-content.tsx          # Expandable content wrapper
│   ├── agent-steps.tsx            # Step progress indicators
│   └── use-click-outside.ts       # Click-outside hook
│
├── flows/                         # Flow definitions
│   ├── types.ts                   # FlowMetadata, FlowHookResult types
│   ├── registry.ts                # Flow type -> { metadata, useHook }
│   │
│   ├── documents/
│   │   ├── upload/
│   │   │   ├── index.ts           # Barrel export
│   │   │   ├── metadata.ts        # uploadFlowMetadata
│   │   │   ├── use-upload-flow.ts # useUploadFlow hook
│   │   │   └── steps/             # Step components
│   │   │       ├── upload-dropzone.tsx
│   │   │       ├── upload-configure.tsx
│   │   │       ├── upload-fields.tsx
│   │   │       ├── upload-extracting.tsx
│   │   │       └── upload-complete.tsx
│   │   └── extract/
│   │       ├── metadata.ts
│   │       └── use-extract-flow.ts
│   │
│   ├── stacks/
│   │   ├── create/
│   │   ├── edit/
│   │   └── add-documents/
│   │
│   └── tables/
│       ├── create/
│       ├── manage-columns/
│       └── extract/
│
├── panels/
│   └── confirm-close.tsx          # Confirmation dialog (existing)
│
├── stores/
│   └── agent-store.ts             # Zustand store (updated)
│
├── agent-actions.tsx              # Context-aware action buttons (updated)
└── index.ts                       # Barrel export (updated)
```

### Key Types

```typescript
// flows/types.ts
export interface FlowMetadata<TStep extends string> {
  type: string
  steps: readonly TStep[]
  icons: Record<TStep, React.ComponentType<{ className?: string }>>
  statusText: Record<TStep, string>
  minimizedText: string  // "Continue file upload..."
  components: Record<TStep, React.ComponentType<unknown>>
  backableSteps: readonly TStep[]
  confirmationSteps: readonly TStep[]
}

export interface FlowHookResult<TStep extends string> {
  step: TStep
  canGoBack: boolean
  needsConfirmation: boolean
  onBack: () => void
  stepProps: Record<TStep, Record<string, unknown>>
}
```

### Spring Animation Config

```typescript
// Shared spring config for iOS-like feel
export const springConfig = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
  mass: 1,
}
```

---

## Dependencies to Install

```bash
npm install motion
```

---

## Success Criteria

From design doc + architecture decision:

- [ ] Single unified card replaces separate bar + popup
- [ ] Input morphs to status bar with spring animation
- [ ] Content expands upward from bottom
- [ ] Click outside collapses card
- [ ] App content renders behind bar
- [ ] Steps display with expandable history
- [ ] Minimized state shows "Continue [flow]..." with controls
- [x] Config + Hook Hybrid pattern implemented
- [x] Flow registry enables easy addition of new flows
- [x] Upload flow fully migrated and functional
- [ ] 7 remaining flow types stubbed with metadata

---

## Related Documents

- Design: `docs/plans/in-progress/agent-bar-redesign/2026-01-01-agent-bar-redesign-design.md`
- Previous refactor: `docs/plans/complete/agent-ui-refactor/`
- Current implementation: `frontend/components/agent/`
