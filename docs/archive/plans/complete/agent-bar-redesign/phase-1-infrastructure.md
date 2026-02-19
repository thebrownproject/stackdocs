# Phase 1: Infrastructure

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the foundational types, flow registry, and base infrastructure for the Config + Hook Hybrid architecture.

**Dependencies:** None (this is the first phase)

---

## Task 1: Install Motion Library

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install motion**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npm install motion
```

**Step 2: Verify installation**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npm ls motion
```

Expected: `motion@x.x.x` listed

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json && git commit -m "chore: install motion library for spring animations"
```

---

## Task 2: Create Flow Types

**Files:**
- Create: `frontend/components/agent/flows/types.ts`

**Step 1: Create the types file**

```typescript
// frontend/components/agent/flows/types.ts

// FIX #7: Use inline type instead of non-existent Icon import
// FIX #2: Use React.ComponentType<any> to allow step components with specific props
// FIX #11: Add shared FlowPlaceholder component for DRY stub flows

/**
 * Icon component type - matches lucide-react icon signature.
 */
export type IconComponent = React.ComponentType<{ className?: string }>

/**
 * Static metadata for a flow type.
 * Defines visual properties and step components.
 * No logic - just data.
 */
export interface FlowMetadata<TStep extends string> {
  /** Unique flow type identifier */
  type: string

  /** Ordered list of steps in this flow */
  steps: readonly TStep[]

  /** Icon for each step (shown in status bar) */
  icons: Record<TStep, IconComponent>

  /**
   * Status text for each step (shown in status bar).
   *
   * NOTE: This provides default/static text per step. For dynamic updates
   * like "Uploading document.pdf..." or "Extracting field 3 of 12...",
   * call `setStatus('processing', 'Your dynamic message')` from your hook.
   */
  statusText: Record<TStep, string>

  /** Text shown when flow is minimized (e.g., "Continue file upload...") */
  minimizedText: string

  /** Component to render for each step - uses `any` to allow typed step props */
  components: Record<TStep, React.ComponentType<any>>

  /** Steps where back button should appear */
  backableSteps: readonly TStep[]

  /** Steps that require confirmation before closing */
  confirmationSteps: readonly TStep[]

  /** Optional: Previous step mapping for back navigation */
  prevSteps?: Partial<Record<TStep, TStep>>
}

/**
 * Result returned by a flow's logic hook.
 * Contains computed state and handlers.
 *
 * FIX #3: stepProps uses `any` to allow strongly-typed props in hooks
 * while remaining compatible with the generic FlowHookResult interface.
 */
export interface FlowHookResult<TStep extends string> {
  /** Current step */
  step: TStep

  /** Whether back button should be enabled */
  canGoBack: boolean

  /** Whether closing requires confirmation */
  needsConfirmation: boolean

  /** Handler for back button */
  onBack: () => void

  /** Props for each step component, keyed by step name */
  stepProps: Record<string, any>
}

/**
 * A registered flow combines metadata with its logic hook.
 */
export interface FlowRegistration<TStep extends string = string> {
  metadata: FlowMetadata<TStep>
  useHook: () => FlowHookResult<TStep>
}

/**
 * Spring animation config for iOS-like feel.
 * Used consistently across all agent card animations.
 *
 * Values chosen for snappy, controlled iOS-like motion:
 * - stiffness: 400 = snappy response
 * - damping: 30 = controlled oscillation (minimal overshoot)
 * - mass: 1 = standard inertia
 */
export const springConfig = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
  mass: 1,
}

/**
 * Gentler spring for content expansion.
 */
export const contentSpringConfig = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 25,
  mass: 0.8,
}

/**
 * FIX #11: Shared placeholder component for unimplemented flow steps.
 * Use this in stub flows instead of repeating the same component.
 */
export function FlowPlaceholder({ flowName }: { flowName: string }) {
  return (
    <div className="text-sm text-muted-foreground text-center py-8">
      {flowName} flow is not yet implemented.
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/agent/flows/types.ts && git commit -m "feat(agent): add FlowMetadata and FlowHookResult types"
```

---

## Task 3: Create Flow Registry

**Files:**
- Create: `frontend/components/agent/flows/registry.ts`

**Step 1: Create the registry file**

```typescript
// frontend/components/agent/flows/registry.ts
import type { FlowRegistration } from './types'
import type { AgentFlow } from '../stores/agent-store'

/**
 * Registry of all flow types.
 * Maps flow type string to its metadata and hook.
 *
 * Add new flows here as they're implemented.
 */
export const flowRegistry: Partial<Record<NonNullable<AgentFlow>['type'], FlowRegistration>> = {
  // Flows will be registered here as they're migrated/created
  // Example:
  // upload: {
  //   metadata: uploadFlowMetadata,
  //   useHook: useUploadFlow,
  // },
}

/**
 * Get a flow registration by type.
 * Returns undefined if flow type is not registered.
 */
export function getFlowRegistration(flowType: string): FlowRegistration | undefined {
  return flowRegistry[flowType as keyof typeof flowRegistry]
}

/**
 * Check if a flow type is registered.
 */
export function isFlowRegistered(flowType: string): boolean {
  return flowType in flowRegistry
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/agent/flows/registry.ts && git commit -m "feat(agent): add flow registry for Config + Hook pattern"
```

---

## Task 4: Create Click-Outside Hook

**Files:**
- Create: `frontend/components/agent/card/use-click-outside.ts`

**Step 1: Create the hook file**

```typescript
// frontend/components/agent/card/use-click-outside.ts
import { useEffect, useRef, type RefObject } from 'react'

/**
 * Hook to detect clicks outside of a referenced element and Escape key presses.
 * Used to collapse the agent card when clicking elsewhere or pressing Escape.
 *
 * FIX #4: Uses useRef pattern for handler to prevent stale closures.
 * The handler can be passed without useCallback - the ref ensures
 * the latest handler is always called.
 *
 * FIX #10: Also listens for Escape key to dismiss.
 *
 * @param handler - Callback when click outside or Escape is detected
 * @param enabled - Whether the listener is active (default: true)
 * @returns Ref to attach to the element
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const ref = useClickOutside(() => setOpen(false), isOpen)
 *   return <div ref={ref}>Content</div>
 * }
 * ```
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
  handler: () => void,
  enabled: boolean = true
): RefObject<T | null> {
  const ref = useRef<T>(null)
  // FIX #4: Store handler in ref to avoid stale closures
  const handlerRef = useRef(handler)

  // Update handler ref on each render (no deps needed)
  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    if (!enabled) return

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node

      // Ignore clicks on the element or its children
      if (ref.current && !ref.current.contains(target)) {
        // Ignore clicks on modals/dialogs (they have their own click handling)
        const isInModal = (target as HTMLElement).closest?.(
          '[role="dialog"], [role="alertdialog"], [data-radix-portal]'
        )
        if (!isInModal) {
          handlerRef.current()
        }
      }
    }

    // FIX #10: Handle Escape key to dismiss
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        handlerRef.current()
      }
    }

    // Use mousedown for faster response (before click completes)
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [enabled]) // FIX #4: Only `enabled` in deps - handler accessed via ref

  return ref
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/agent/card/use-click-outside.ts && git commit -m "feat(agent): add useClickOutside hook for card collapse"
```

---

## Task 5: Update Agent Store

**Files:**
- Modify: `frontend/components/agent/stores/agent-store.ts`

**Step 1: Read current store**

Review the current implementation at `frontend/components/agent/stores/agent-store.ts`.

**Step 2: Update the store**

The store needs these changes:
1. Simplify state: `isPopupOpen` -> `isExpanded` (unified card, no separate popup)
2. Add computed selector for minimized state
3. Keep existing flow, status, events logic

Update the file with these changes:

```typescript
// frontend/components/agent/stores/agent-store.ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import type {} from '@redux-devtools/extension' // required for devtools typing
import type { AgentEvent } from '@/lib/agent-api'
import type { CustomField, ExtractionMethod } from '@/types/upload'

// Upload step type (extends existing UploadStep with extraction states)
export type UploadFlowStep = 'dropzone' | 'configure' | 'fields' | 'extracting' | 'complete'

// Discriminated union for type-safe flow routing
export type AgentFlow =
  // Document flows
  | { type: 'upload'; step: UploadFlowStep; data: UploadFlowData }
  | { type: 'extract-document'; documentId: string; step: string }
  // Stack flows (post-MVP)
  | { type: 'create-stack'; step: string }
  | { type: 'edit-stack'; stackId: string; step: string }
  | { type: 'add-documents'; stackId: string; step: string }
  // Table flows (post-MVP)
  | { type: 'create-table'; stackId: string; step: string }
  | { type: 'manage-columns'; stackId: string; tableId: string; step: string }
  | { type: 'extract-table'; stackId: string; tableId: string; step: string }
  | null

export interface UploadFlowData {
  file: File | null
  documentId: string | null
  documentName: string
  extractionMethod: ExtractionMethod
  customFields: CustomField[]
  uploadStatus: 'idle' | 'uploading' | 'ready' | 'error'
  uploadError: string | null
  extractionError: string | null
}

export type AgentStatus = 'idle' | 'processing' | 'waiting' | 'complete' | 'error'

interface AgentStore {
  // Card state (unified - no separate popup)
  flow: AgentFlow
  isExpanded: boolean  // Card content visible (actions or flow content)

  // Dynamic bar state
  status: AgentStatus
  statusText: string

  // SSE events (capped at 100)
  events: AgentEvent[]

  // Actions
  openFlow: (flow: NonNullable<AgentFlow>) => void
  setStep: (step: string) => void
  updateFlowData: (data: Partial<UploadFlowData>) => void
  setStatus: (status: AgentStatus, text: string) => void
  addEvent: (event: AgentEvent) => void
  expand: () => void
  collapse: () => void
  toggle: () => void
  close: () => void
  reset: () => void

  // FIX #6: Backwards-compatible action aliases (deprecated)
  // These will be removed after Phase 4 cleanup
  /** @deprecated Use expand() instead */
  expandPopup: () => void
  /** @deprecated Use collapse() instead */
  collapsePopup: () => void
  /** @deprecated Use expand/collapse() instead */
  setExpanded: (expanded: boolean) => void
}

export const initialUploadData: UploadFlowData = {
  file: null,
  documentId: null,
  documentName: '',
  extractionMethod: 'auto',
  customFields: [],
  uploadStatus: 'idle',
  uploadError: null,
  extractionError: null,
}

export const useAgentStore = create<AgentStore>()(
  devtools(
    persist(
      (set, get) => ({
        flow: null,
        isExpanded: false,
        status: 'idle',
        statusText: 'How can I help you today?',
        events: [],

        openFlow: (flow) => set({
          flow,
          isExpanded: true,
          status: 'idle',
          statusText: getFlowStatusText(flow),
          events: [],
        }, undefined, 'agent/openFlow'),

        setStep: (step) => set((state) => {
          if (!state.flow) return state
          return {
            flow: { ...state.flow, step } as AgentFlow,
            statusText: getStepStatusText(state.flow.type, step),
          }
        }, undefined, 'agent/setStep'),

        updateFlowData: (data) => set((state) => {
          if (!state.flow || state.flow.type !== 'upload') return state
          return {
            flow: {
              ...state.flow,
              data: { ...state.flow.data, ...data },
            },
          }
        }, undefined, 'agent/updateFlowData'),

        setStatus: (status, statusText) => set({ status, statusText }, undefined, 'agent/setStatus'),

        addEvent: (event) => set((state) => ({
          events: [...state.events, event].slice(-100), // Cap at 100
        }), undefined, 'agent/addEvent'),

        expand: () => set({ isExpanded: true }, undefined, 'agent/expand'),

        collapse: () => set({ isExpanded: false }, undefined, 'agent/collapse'),

        toggle: () => set((state) => ({ isExpanded: !state.isExpanded }), undefined, 'agent/toggle'),

        close: () => set({
          flow: null,
          isExpanded: false,
          status: 'idle',
          statusText: 'How can I help you today?',
          events: [],
        }, undefined, 'agent/close'),

        reset: () => set({
          flow: null,
          isExpanded: false,
          status: 'idle',
          statusText: 'How can I help you today?',
          events: [],
        }, undefined, 'agent/reset'),

        // FIX #6: Backwards-compatible action aliases
        // These delegate to the new actions and will be removed after migration
        expandPopup: () => set({ isExpanded: true }, undefined, 'agent/expandPopup'),
        collapsePopup: () => set({ isExpanded: false }, undefined, 'agent/collapsePopup'),
        setExpanded: (isExpanded) => set({ isExpanded }, undefined, 'agent/setExpanded'),
      }),
      {
        name: 'agent-store',
        partialize: (state) => ({
          flow: state.flow
            ? {
                ...state.flow,
                ...(state.flow.type === 'upload' && {
                  data: {
                    ...state.flow.data,
                    file: null, // File objects can't be serialized
                  },
                }),
              }
            : null,
          isExpanded: state.isExpanded,
        }),
      }
    ),
    { name: 'AgentStore', enabled: process.env.NODE_ENV !== 'production' }
  )
)

// Helper functions for status text
function getFlowStatusText(flow: NonNullable<AgentFlow>): string {
  switch (flow.type) {
    case 'upload': return 'Drop a file to get started'
    case 'create-stack': return 'Create a new stack'
    case 'extract-document': return 'Re-extract document'
    case 'edit-stack': return 'Edit stack'
    case 'add-documents': return 'Add documents to stack'
    case 'create-table': return 'Define extraction columns'
    case 'manage-columns': return 'Manage table columns'
    case 'extract-table': return 'Extract data from documents'
    default: return 'How can I help you today?'
  }
}

function getStepStatusText(flowType: string, step: string): string {
  // Upload flow steps
  if (flowType === 'upload') {
    switch (step) {
      case 'dropzone': return 'Drop a file to get started'
      case 'configure': return 'Configure extraction settings'
      case 'fields': return 'Specify fields to extract'
      case 'extracting': return 'Extracting...'
      case 'complete': return 'Extraction complete'
    }
  }
  // Default for other flows
  return 'Working...'
}

// Title helpers for flow steps (kept for backwards compatibility)
export function getUploadTitle(step: UploadFlowStep): string {
  switch (step) {
    case 'dropzone': return 'Upload Document'
    case 'configure': return 'Configure Extraction'
    case 'fields': return 'Specify Fields'
    case 'extracting': return 'Extracting...'
    case 'complete': return 'Complete'
  }
}

// Selector helpers
export const useAgentFlow = () => useAgentStore((s) => s.flow)
export const useAgentStatus = () => useAgentStore(
  useShallow((s) => ({ status: s.status, statusText: s.statusText }))
)
export const useAgentExpanded = () => useAgentStore((s) => s.isExpanded)
export const useAgentEvents = () => useAgentStore((s) => s.events)

// Backwards compatibility - deprecated, use useAgentExpanded
export const useAgentPopup = () => useAgentStore(
  useShallow((s) => ({ isPopupOpen: s.isExpanded, isExpanded: s.isExpanded }))
)
```

**Step 3: Verify TypeScript compiles**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit
```

Expected: No errors (or only errors from components that need updating in Phase 2)

**Step 4: Commit**

```bash
git add frontend/components/agent/stores/agent-store.ts && git commit -m "refactor(agent): update store for unified card (isExpanded replaces isPopupOpen)"
```

---

## Task 6: Create Flows Directory Structure

**Files:**
- Create: `frontend/components/agent/flows/documents/upload/index.ts`
- Create: `frontend/components/agent/card/index.ts`

**Step 1: Create directory structure with placeholder files**

```bash
mkdir -p /Users/fraserbrown/stackdocs/frontend/components/agent/flows/documents/upload/steps
mkdir -p /Users/fraserbrown/stackdocs/frontend/components/agent/flows/documents/extract
mkdir -p /Users/fraserbrown/stackdocs/frontend/components/agent/flows/stacks/create
mkdir -p /Users/fraserbrown/stackdocs/frontend/components/agent/flows/stacks/edit
mkdir -p /Users/fraserbrown/stackdocs/frontend/components/agent/flows/stacks/add-documents
mkdir -p /Users/fraserbrown/stackdocs/frontend/components/agent/flows/tables/create
mkdir -p /Users/fraserbrown/stackdocs/frontend/components/agent/flows/tables/manage-columns
mkdir -p /Users/fraserbrown/stackdocs/frontend/components/agent/flows/tables/extract
```

**Step 2: Create upload flow barrel export**

```typescript
// frontend/components/agent/flows/documents/upload/index.ts
// Barrel export for upload flow
// Will be populated in Phase 3

export {}
```

**Step 3: Create card barrel export**

```typescript
// frontend/components/agent/card/index.ts
// Barrel export for card components
export { useClickOutside } from './use-click-outside'
// AgentCard, AgentStatusBar, etc. will be added in Phase 2
```

**Step 4: Commit**

```bash
git add frontend/components/agent/flows frontend/components/agent/card && git commit -m "chore(agent): create directory structure for flows and card"
```

---

## Phase 1 Checklist

- [x] Motion library installed
- [x] FlowMetadata and FlowHookResult types defined
- [x] Flow registry created (empty, ready for flows)
- [x] useClickOutside hook implemented
- [x] Agent store updated for unified card
- [x] Directory structure created for all 8 flows

**Completed:** 2026-01-01 (Session 85)
**Commit:** 4980a6c

---

## Next Phase

Continue to [Phase 2: Unified Card](./phase-2-unified-card.md) to build the AgentCard component with animations.
