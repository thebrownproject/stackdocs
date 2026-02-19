# Agent UI Foundation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the core agent infrastructure - Zustand store, AgentBar, AgentPopup, and barrel exports.

**Architecture:** Zustand store with discriminated unions for type-safe flow routing. Components use selectors to prevent re-renders.

**Tech Stack:** Zustand, shadcn/ui, Tabler Icons

---

## Task 0: Add Missing Icon Exports

**Files:**
- Edit: `frontend/components/icons/index.ts`

**Step 1: Add ChevronUp and QuestionMark icons**

Add these exports to the icons barrel file:

```typescript
// Add to Navigation & chevrons section
IconChevronUp as ChevronUp,

// Add new section or to Close & actions
IconQuestionMark as QuestionMark,
```

**Step 2: Verify icons are available**

Run: `grep -E "ChevronUp|QuestionMark" frontend/components/icons/index.ts`
Expected: Both icons should be listed

**Step 3: Commit**

```bash
git add frontend/components/icons/index.ts
git commit -m "feat(icons): add ChevronUp and QuestionMark icons"
```

---

## Task 1: Create Agent Store

**Files:**
- Create: `frontend/components/agent/stores/agent-store.ts`

**Step 1: Create store file with Zustand**

> **Note (Gemini recommendation):** We use `persist` middleware to save flow state to localStorage.
> This prevents users from losing their upload progress on accidental page refresh - especially
> important during the multi-step upload flow where they've already configured extraction settings.

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
  | { type: 'extract-document'; documentId: string }
  // Stack flows (post-MVP)
  | { type: 'create-stack' }
  | { type: 'edit-stack'; stackId: string }
  | { type: 'add-documents'; stackId: string }
  // Table flows (post-MVP)
  | { type: 'create-table'; stackId: string }
  | { type: 'manage-columns'; stackId: string; tableId: string }
  | { type: 'extract-table'; stackId: string; tableId: string }
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
  // Popup state
  flow: AgentFlow
  isExpanded: boolean  // Actions visible in bar
  isPopupOpen: boolean // Popup visible

  // Dynamic bar state
  status: AgentStatus
  statusText: string

  // SSE events (capped at 100)
  events: AgentEvent[]

  // Actions
  openFlow: (flow: NonNullable<AgentFlow>) => void
  setStep: (step: UploadFlowStep) => void
  updateFlowData: (data: Partial<UploadFlowData>) => void
  setStatus: (status: AgentStatus, text: string) => void
  addEvent: (event: AgentEvent) => void
  setExpanded: (expanded: boolean) => void
  collapsePopup: () => void
  expandPopup: () => void
  close: () => void
  reset: () => void
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
        isPopupOpen: false,
        status: 'idle',
        statusText: 'How can I help you today?',
        events: [],

        openFlow: (flow) => set({
          flow,
          isPopupOpen: true,
          status: 'idle',
          statusText: getFlowStatusText(flow),
          events: [],
        }, undefined, 'agent/openFlow'),

        setStep: (step) => set((state) => {
          if (!state.flow || state.flow.type !== 'upload') return state
          return {
            flow: { ...state.flow, step },
            statusText: getStepStatusText(step),
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

        setExpanded: (isExpanded) => set({ isExpanded }, undefined, 'agent/setExpanded'),

        collapsePopup: () => set({ isPopupOpen: false }, undefined, 'agent/collapsePopup'),

        expandPopup: () => set({ isPopupOpen: true }, undefined, 'agent/expandPopup'),

        close: () => set({
          flow: null,
          isPopupOpen: false,
          status: 'idle',
          statusText: 'How can I help you today?',
          events: [],
        }, undefined, 'agent/close'),

        reset: () => set({
          flow: null,
          isPopupOpen: false,
          isExpanded: false,
          status: 'idle',
          statusText: 'How can I help you today?',
          events: [],
        }, undefined, 'agent/reset'),
      }),
      {
        name: 'agent-store', // localStorage key
        // Only persist flow state - exclude non-serializable data and transient UI state
        partialize: (state) => ({
          flow: state.flow
            ? {
                ...state.flow,
                // For upload flows, exclude File objects (not serializable)
                ...(state.flow.type === 'upload' && {
                  data: {
                    ...state.flow.data,
                    file: null, // File objects can't be serialized to localStorage
                  },
                }),
              }
            : null,
          isPopupOpen: state.isPopupOpen,
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
    default: return 'How can I help you today?'
  }
}

function getStepStatusText(step: UploadFlowStep): string {
  switch (step) {
    case 'dropzone': return 'Drop a file to get started'
    case 'configure': return 'Configure extraction settings'
    case 'fields': return 'Specify fields to extract'
    case 'extracting': return 'Extracting...'
    case 'complete': return 'Extraction complete'
  }
}

// Selector helpers (useShallow for object selectors to prevent unnecessary re-renders)
export const useAgentFlow = () => useAgentStore((s) => s.flow)
export const useAgentStatus = () => useAgentStore(
  useShallow((s) => ({ status: s.status, statusText: s.statusText }))
)
export const useAgentPopup = () => useAgentStore(
  useShallow((s) => ({ isPopupOpen: s.isPopupOpen, isExpanded: s.isExpanded }))
)
export const useAgentEvents = () => useAgentStore((s) => s.events)
```

**Step 2: Verify store compiles**

Run: `npx tsc --noEmit frontend/components/agent/stores/agent-store.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/agent/stores/agent-store.ts
git commit -m "feat(agent): add Zustand store with discriminated union flows"
```

---

## Task 2: Create Agent Bar Component

**Files:**
- Create: `frontend/components/agent/agent-bar.tsx`

**Step 1: Create the dynamic agent bar**

```typescript
// frontend/components/agent/agent-bar.tsx
'use client'

import { useCallback, useState } from 'react'
import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useAgentStore, useAgentStatus, useAgentPopup, type AgentStatus } from './stores/agent-store'
import { AgentActions } from './agent-actions'

interface AgentBarProps {
  className?: string
}

export function AgentBar({ className }: AgentBarProps) {
  const [message, setMessage] = useState('')
  const { status, statusText } = useAgentStatus()
  const { isExpanded, isPopupOpen } = useAgentPopup()
  const setExpanded = useAgentStore((s) => s.setExpanded)
  const expandPopup = useAgentStore((s) => s.expandPopup)
  const flow = useAgentStore((s) => s.flow)

  const isDisabled = status === 'processing'
  const showActions = isExpanded && !flow // Only show actions when no flow is active

  const handleFocus = useCallback(() => {
    setExpanded(true)
  }, [setExpanded])

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Don't collapse if focus moves within the bar
    if (e.currentTarget.contains(e.relatedTarget)) return
    setExpanded(false)
  }, [setExpanded])

  const handleExpandClick = useCallback(() => {
    if (flow) {
      expandPopup()
    }
  }, [flow, expandPopup])

  const handleSubmit = useCallback(() => {
    const trimmed = message.trim()
    if (!trimmed || isDisabled) return
    // TODO: Natural language processing (post-MVP)
    setMessage('')
  }, [message, isDisabled])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isDisabled) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Status icon based on current state
  const StatusIcon = getStatusIcon(status)
  const statusIconClass = getStatusIconClass(status)

  return (
    <div
      className={cn('relative', className)}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <div
        className={cn(
          'flex flex-col',
          'bg-sidebar border rounded-xl shadow-md',
          'transition-colors duration-150',
          'hover:border-muted-foreground/30',
          'focus-within:border-muted-foreground/30',
          isDisabled && 'opacity-50'
        )}
      >
        {/* Action buttons - shown when expanded and no flow active */}
        {showActions && (
          <div className="px-3 pt-3 pb-1">
            <AgentActions />
          </div>
        )}

        {/* Main input row */}
        <div className="flex items-center pl-[30px] pr-3.5 py-3">
          <StatusIcon
            className={cn(
              'size-4 transition-colors shrink-0',
              statusIconClass,
              status === 'processing' && 'animate-spin'
            )}
          />
          <Tooltip delayDuration={500} open={!message ? undefined : false}>
            <TooltipTrigger asChild>
              <Input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={statusText}
                aria-label="AI chat input"
                disabled={isDisabled}
                className="flex-1 border-none !bg-transparent shadow-none focus-visible:ring-0 !text-base text-foreground placeholder:text-muted-foreground -ml-1"
              />
            </TooltipTrigger>
            <TooltipContent
              side="top"
              sideOffset={8}
              className="text-center max-w-[280px]"
            >
              Ask your AI agent to help with documents
            </TooltipContent>
          </Tooltip>

          {/* Expand/Send button */}
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                onClick={message.trim() ? handleSubmit : handleExpandClick}
                disabled={isDisabled && !flow}
                className="size-8 rounded-full shrink-0"
                aria-label={message.trim() ? 'Send message' : 'Expand'}
              >
                {message.trim() ? (
                  <Icons.ArrowUp className="size-5" />
                ) : (
                  <Icons.ChevronUp className={cn(
                    'size-5 transition-transform',
                    isPopupOpen && 'rotate-180'
                  )} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {message.trim() ? 'Send message' : (isPopupOpen ? 'Collapse' : 'Expand')}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

function getStatusIcon(status: AgentStatus) {
  switch (status) {
    case 'processing': return Icons.Loader2
    case 'waiting': return Icons.QuestionMark
    case 'complete': return Icons.Check
    case 'error': return Icons.X
    case 'idle': return Icons.Stack
  }
}

function getStatusIconClass(status: AgentStatus) {
  switch (status) {
    case 'processing': return 'text-muted-foreground'
    case 'complete': return 'text-green-500'
    case 'error': return 'text-destructive'
    case 'idle':
    case 'waiting': return 'text-muted-foreground group-hover:text-foreground group-focus-within:text-foreground'
  }
}
```

**Step 2: Verify component compiles**

Run: `npx tsc --noEmit frontend/components/agent/agent-bar.tsx`
Expected: May fail due to missing AgentActions (created next)

**Step 3: Commit (after Task 3)**

---

## Task 3: Create Agent Actions Component

**Files:**
- Create: `frontend/components/agent/agent-actions.tsx`

**Step 1: Create context-aware action buttons**

```typescript
// frontend/components/agent/agent-actions.tsx
'use client'

import { usePathname } from 'next/navigation'
import * as Icons from '@/components/icons'
import { ActionButton } from '@/components/layout/action-button'
import { useAgentStore, initialUploadData, type AgentFlow } from './stores/agent-store'

interface ActionDef {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  flow: NonNullable<AgentFlow>
  tooltip?: string
}

// Actions by route pattern
const ACTION_CONFIG: Record<string, ActionDef[]> = {
  '/documents': [
    {
      id: 'upload',
      label: 'Upload',
      icon: Icons.Upload,
      flow: { type: 'upload', step: 'dropzone', data: initialUploadData },
      tooltip: 'Upload a new document',
    },
    {
      id: 'create-stack',
      label: 'Create Stack',
      icon: Icons.Stack,
      flow: { type: 'create-stack' },
      tooltip: 'Create a new document stack',
    },
  ],
  '/stacks': [
    {
      id: 'create-stack',
      label: 'Create Stack',
      icon: Icons.Stack,
      flow: { type: 'create-stack' },
      tooltip: 'Create a new document stack',
    },
    {
      id: 'upload',
      label: 'Upload',
      icon: Icons.Upload,
      flow: { type: 'upload', step: 'dropzone', data: initialUploadData },
      tooltip: 'Upload a new document',
    },
  ],
}

export function AgentActions() {
  const pathname = usePathname()
  const openFlow = useAgentStore((s) => s.openFlow)

  // Match route to actions (exact match or prefix)
  const actions = getActionsForRoute(pathname)

  if (actions.length === 0) return null

  return (
    <div className="flex items-center gap-1">
      {actions.map((action) => (
        <ActionButton
          key={action.id}
          icon={<action.icon className="size-3.5" />}
          tooltip={action.tooltip}
          onClick={() => openFlow(action.flow)}
        >
          {action.label}
        </ActionButton>
      ))}
    </div>
  )
}

function getActionsForRoute(pathname: string): ActionDef[] {
  // Try exact match first
  if (ACTION_CONFIG[pathname]) {
    return ACTION_CONFIG[pathname]
  }

  // Try prefix match (e.g., /documents/[id] matches /documents)
  for (const [route, actions] of Object.entries(ACTION_CONFIG)) {
    if (pathname.startsWith(route + '/')) {
      return actions
    }
  }

  // Fallback to documents actions
  return ACTION_CONFIG['/documents'] || []
}
```

**Step 2: Verify components compile**

Run: `npx tsc --noEmit frontend/components/agent/agent-bar.tsx frontend/components/agent/agent-actions.tsx`
Expected: No errors

**Step 3: Commit foundation components**

```bash
git add frontend/components/agent/agent-bar.tsx frontend/components/agent/agent-actions.tsx
git commit -m "feat(agent): add AgentBar and AgentActions components"
```

---

## Task 4: Create Agent Popup Container

**Files:**
- Create: `frontend/components/agent/agent-popup.tsx`

**Step 1: Create popup container with chrome**

```typescript
// frontend/components/agent/agent-popup.tsx
'use client'

import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { useAgentStore, useAgentFlow, useAgentPopup } from './stores/agent-store'

interface AgentPopupProps {
  children: React.ReactNode
  title?: string
  showBack?: boolean
  onBack?: () => void
}

export function AgentPopup({ children, title, showBack, onBack }: AgentPopupProps) {
  const { isPopupOpen } = useAgentPopup()
  const flow = useAgentFlow()
  const collapsePopup = useAgentStore((s) => s.collapsePopup)
  const close = useAgentStore((s) => s.close)

  // Don't render if no flow active
  if (!flow) return null

  const handleClose = () => {
    // TODO: Add confirmation if mid-flow (Phase 2, Task 4)
    close()
  }

  return (
    <Collapsible open={isPopupOpen} onOpenChange={(open) => !open && collapsePopup()}>
      <CollapsibleContent forceMount className={cn(!isPopupOpen && 'hidden')}>
        <div className="rounded-xl border border-border bg-background shadow-lg mb-3">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              {showBack && onBack && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={onBack}
                >
                  <Icons.ChevronLeft className="size-4" />
                  <span className="sr-only">Go back</span>
                </Button>
              )}
              {title && (
                <h3 className="text-sm font-medium">{title}</h3>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={collapsePopup}
                aria-label="Collapse popup"
              >
                <Icons.ChevronDown className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={handleClose}
                aria-label="Close"
              >
                <Icons.X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            {children}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
```

**Step 2: Verify component compiles**

Run: `npx tsc --noEmit frontend/components/agent/agent-popup.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/agent/agent-popup.tsx
git commit -m "feat(agent): add AgentPopup container component"
```

---

## Task 5: Create Agent Container and Barrel Export

**Files:**
- Create: `frontend/components/agent/agent-container.tsx`
- Create: `frontend/components/agent/agent-popup-content.tsx`
- Create: `frontend/components/agent/index.ts`

**Step 1: Create agent container that orchestrates bar + popup**

```typescript
// frontend/components/agent/agent-container.tsx
'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { AgentBar } from './agent-bar'
import { AgentPopupContent } from './agent-popup-content'

// Routes where the agent bar should be visible
const AGENT_ROUTES = ['/documents', '/stacks']

interface AgentContainerProps {
  className?: string
}

export function AgentContainer({ className }: AgentContainerProps) {
  const pathname = usePathname()

  // Self-managed visibility - only show on supported routes
  const shouldShow = AGENT_ROUTES.some(route => pathname.startsWith(route))
  if (!shouldShow) return null

  return (
    <div className={cn('relative w-full max-w-[640px] mx-auto', className)}>
      {/* Popup floats above bar */}
      <div className="absolute bottom-full left-0 right-0">
        <AgentPopupContent />
      </div>

      {/* Dynamic chat bar */}
      <AgentBar />
    </div>
  )
}
```

**Step 2: Create popup content router**

```typescript
// frontend/components/agent/agent-popup-content.tsx
'use client'

import { useAgentFlow } from './stores/agent-store'
import { AgentPopup } from './agent-popup'

export function AgentPopupContent() {
  const flow = useAgentFlow()

  if (!flow) return null

  switch (flow.type) {
    case 'upload':
      // TODO: Import and render UploadFlow (Phase 2)
      return (
        <AgentPopup title={getUploadTitle(flow.step)}>
          <div className="text-sm text-muted-foreground">
            Upload flow coming in Phase 2...
          </div>
        </AgentPopup>
      )
    case 'create-stack':
      return (
        <AgentPopup title="Create Stack">
          <div className="text-sm text-muted-foreground">
            Create stack flow coming post-MVP...
          </div>
        </AgentPopup>
      )
    default:
      return null
  }
}

function getUploadTitle(step: string): string {
  switch (step) {
    case 'dropzone': return 'Upload Document'
    case 'configure': return 'Configure Extraction'
    case 'fields': return 'Specify Fields'
    case 'extracting': return 'Extracting...'
    case 'complete': return 'Complete'
    default: return 'Upload Document'
  }
}
```

**Step 3: Create barrel export**

```typescript
// frontend/components/agent/index.ts

// Components
export { AgentContainer } from './agent-container'
export { AgentBar } from './agent-bar'
export { AgentPopup } from './agent-popup'
export { AgentActions } from './agent-actions'

// Hooks & constants
export { useAgentStore, useAgentFlow, useAgentStatus, useAgentPopup, useAgentEvents, initialUploadData } from './stores/agent-store'

// Types
export type { AgentFlow, UploadFlowData, UploadFlowStep, AgentStatus } from './stores/agent-store'
```

**Step 4: Verify all components compile**

Run: `npx tsc --noEmit frontend/components/agent/index.ts`
Expected: No errors

**Step 5: Commit**

```bash
git add frontend/components/agent/
git commit -m "feat(agent): add AgentContainer and barrel exports"
```
