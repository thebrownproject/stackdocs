# Phase 2: Unified Card

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the unified AgentCard component that replaces the separate bar + popup with a single animated card.

**Dependencies:** Phase 1 complete (types, registry, click-outside hook, updated store)

---

## Task 1: Create AgentStatusBar Component

**Files:**
- Create: `frontend/components/agent/card/agent-status-bar.tsx`

**Step 1: Create the component**

```typescript
// frontend/components/agent/card/agent-status-bar.tsx
'use client'

import { useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useAgentStore, useAgentStatus, useAgentExpanded, type AgentStatus } from '../stores/agent-store'
import { springConfig } from '../flows/types'

interface AgentStatusBarProps {
  /** Whether a flow is active */
  hasFlow: boolean
  /** Flow-specific icon (overrides status icon when flow active) */
  flowIcon?: React.ComponentType<{ className?: string }>
  /** Whether back button should be shown */
  showBack?: boolean
  /** Handler for back button */
  onBack?: () => void
  /** Whether closing requires confirmation */
  needsConfirmation?: boolean
  /** Handler called when close is requested (may trigger confirmation) */
  onCloseRequest?: () => void
}

export function AgentStatusBar({
  hasFlow,
  flowIcon: FlowIcon,
  showBack,
  onBack,
  needsConfirmation,
  onCloseRequest,
}: AgentStatusBarProps) {
  const [message, setMessage] = useState('')
  const { status, statusText } = useAgentStatus()
  const isExpanded = useAgentExpanded()
  const expand = useAgentStore((s) => s.expand)
  const collapse = useAgentStore((s) => s.collapse)
  const toggle = useAgentStore((s) => s.toggle)

  const isDisabled = status === 'processing'
  const isIdle = !hasFlow && status === 'idle'

  // FIX #12: Use object maps for icons/classes
  const StatusIcon = hasFlow && FlowIcon ? FlowIcon : STATUS_ICONS[status]
  const statusIconClass = STATUS_ICON_CLASSES[status]

  const handleSubmit = useCallback(() => {
    const trimmed = message.trim()
    if (!trimmed || isDisabled) return
    // TODO: Natural language processing (post-MVP)
    setMessage('')
  }, [message, isDisabled])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isDisabled) {
      e.preventDefault()
      handleSubmit()
    }
  }, [isDisabled, handleSubmit])

  const handleChevronClick = useCallback(() => {
    toggle()
  }, [toggle])

  const handleCloseClick = useCallback(() => {
    if (onCloseRequest) {
      onCloseRequest()
    }
  }, [onCloseRequest])

  return (
    <div className="flex items-center gap-2 px-3 py-3">
      {/* Back button (when in flow and showBack is true) */}
      <AnimatePresence mode="wait">
        {showBack && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={springConfig}
          >
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={onBack}
            >
              <Icons.ChevronLeft className="size-4" />
              <span className="sr-only">Go back</span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status icon */}
      <motion.div
        layout
        transition={springConfig}
        className="shrink-0"
      >
        <StatusIcon
          className={cn(
            'size-4 transition-colors',
            statusIconClass,
            status === 'processing' && 'animate-spin'
          )}
        />
      </motion.div>

      {/* Input / Status text */}
      <div className="flex-1 min-w-0">
        {isIdle ? (
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
                className="border-none !bg-transparent shadow-none focus-visible:ring-0 !text-base text-foreground placeholder:text-muted-foreground"
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
        ) : (
          <motion.span
            key={statusText}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-muted-foreground truncate block"
          >
            {statusText}
          </motion.span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Expand/Collapse chevron */}
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={handleChevronClick}
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={springConfig}
              >
                <Icons.ChevronDown className="size-4" />
              </motion.div>
              <span className="sr-only">{isExpanded ? 'Collapse' : 'Expand'}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {isExpanded ? 'Collapse' : 'Expand'}
          </TooltipContent>
        </Tooltip>

        {/* Close button (only when flow active) */}
        <AnimatePresence mode="wait">
          {hasFlow && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={springConfig}
            >
              <Tooltip delayDuration={500}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={handleCloseClick}
                  >
                    <Icons.X className="size-4" />
                    <span className="sr-only">Close</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Close</TooltipContent>
              </Tooltip>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// FIX #12: Use object maps instead of switch statements
// More concise, TypeScript will error if a status is missing
const STATUS_ICONS: Record<AgentStatus, React.ComponentType<{ className?: string }>> = {
  processing: Icons.Loader2,
  waiting: Icons.QuestionMark,
  complete: Icons.Check,
  error: Icons.X,
  idle: Icons.Stack,
}

const STATUS_ICON_CLASSES: Record<AgentStatus, string> = {
  processing: 'text-muted-foreground',
  waiting: 'text-muted-foreground',
  complete: 'text-green-500',
  error: 'text-destructive',
  idle: 'text-muted-foreground',
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/agent/card/agent-status-bar.tsx && git commit -m "feat(agent): add AgentStatusBar with spring animations"
```

---

## Task 2: Create AgentContent Component

**Files:**
- Create: `frontend/components/agent/card/agent-content.tsx`

**Step 1: Create the component**

```typescript
// frontend/components/agent/card/agent-content.tsx
'use client'

import { motion, AnimatePresence } from 'motion/react'
import { contentSpringConfig } from '../flows/types'

interface AgentContentProps {
  /** Whether content should be visible */
  isExpanded: boolean
  /** Content to render */
  children: React.ReactNode
}

/**
 * Expandable content area for the agent card.
 * Animates height from 0 to auto with spring physics.
 */
export function AgentContent({ isExpanded, children }: AgentContentProps) {
  return (
    <AnimatePresence initial={false}>
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={contentSpringConfig}
          className="overflow-hidden"
        >
          {/* Divider */}
          <div className="border-t border-border" />

          {/* Content */}
          <div className="p-4">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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
git add frontend/components/agent/card/agent-content.tsx && git commit -m "feat(agent): add AgentContent with height animation"
```

---

## Task 3: Create AgentSteps Component

> **NOTE:** This component is created for future use but is not integrated into the upload flow
> in Phase 3. The upload flow shows progress via the status bar text. AgentSteps will be
> useful for multi-step processing flows (like stack extraction) that benefit from showing
> completed steps. If not needed, this can be deferred - but it's simple enough to include now.

**Files:**
- Create: `frontend/components/agent/card/agent-steps.tsx`

**Step 1: Create the component**

```typescript
// frontend/components/agent/card/agent-steps.tsx
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { springConfig } from '../flows/types'

interface Step {
  id: string
  label: string
  description?: string
}

interface AgentStepsProps {
  /** All steps in the flow */
  steps: Step[]
  /** Index of current step (0-based) */
  currentIndex: number
  /** Current step description (e.g., "Finding invoice number...") */
  currentDescription?: string
}

/**
 * Step progress indicator for processing flows.
 * Shows current step prominently with expandable history.
 */
export function AgentSteps({ steps, currentIndex, currentDescription }: AgentStepsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const currentStep = steps[currentIndex]
  const completedSteps = steps.slice(0, currentIndex)

  return (
    <div className="space-y-2">
      {/* Completed steps (expandable) */}
      <AnimatePresence initial={false}>
        {isExpanded && completedSteps.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springConfig}
            className="overflow-hidden space-y-1"
          >
            {completedSteps.map((step) => (
              <div
                key={step.id}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Icons.Check className="size-3.5 text-green-500 shrink-0" />
                <span>{step.label}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current step */}
      {currentStep && (
        <div className="flex items-start gap-2">
          <div className="flex items-center gap-2 flex-1">
            {/* Status indicator */}
            <div className="size-4 flex items-center justify-center shrink-0">
              <div className="size-2 rounded-full bg-primary animate-pulse" />
            </div>

            {/* Step info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{currentStep.label}</span>
              </div>
              {currentDescription && (
                <motion.p
                  key={currentDescription}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-muted-foreground truncate"
                >
                  {currentDescription}
                </motion.p>
              )}
            </div>
          </div>

          {/* Expand/collapse toggle (only if there are completed steps) */}
          {completedSteps.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={springConfig}
              >
                <Icons.ChevronDown className="size-3.5" />
              </motion.div>
              <span className="sr-only">
                {isExpanded ? 'Hide completed steps' : 'Show completed steps'}
              </span>
            </Button>
          )}
        </div>
      )}
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
git add frontend/components/agent/card/agent-steps.tsx && git commit -m "feat(agent): add AgentSteps component for progress display"
```

---

## Task 4: Create Main AgentCard Component

**Files:**
- Create: `frontend/components/agent/card/agent-card.tsx`
- Create: `frontend/components/agent/card/flow-error-boundary.tsx`

**Step 1: Create FlowErrorBoundary component**

```typescript
// frontend/components/agent/card/flow-error-boundary.tsx
'use client'

import { Component, type ReactNode } from 'react'
import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * FIX #11: Error boundary to catch crashes in flow step components.
 * Without this, a broken step would crash the entire agent card.
 */
export class FlowErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="rounded-full bg-destructive/10 p-3">
            <Icons.X className="size-5 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-medium">Something went wrong</p>
            <p className="text-xs text-muted-foreground mt-1">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={this.handleReset}>
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
```

**Step 2: Create the main AgentCard component**

```typescript
// frontend/components/agent/card/agent-card.tsx
'use client'

import { useState, useCallback } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import {
  useAgentStore,
  useAgentFlow,
  useAgentExpanded,
  type AgentFlow,
} from '../stores/agent-store'
import { getFlowRegistration } from '../flows/registry'
import { AgentStatusBar } from './agent-status-bar'
import { AgentContent } from './agent-content'
import { AgentActions } from '../agent-actions'
import { ConfirmClose } from '../panels/confirm-close'
import { FlowErrorBoundary } from './flow-error-boundary'
import { useClickOutside } from './use-click-outside'
import { springConfig } from '../flows/types'

interface AgentCardProps {
  className?: string
}

/**
 * Unified agent card that replaces the separate bar + popup.
 * Handles idle state, flow rendering, and all animations.
 *
 * FIX #5: Split into AgentCard (shell) and ActiveFlowContent (hook consumer)
 * to avoid conditional hook calls. Hooks cannot be called conditionally,
 * so the flow hook is called in a child component that only renders when
 * a flow is active.
 */
export function AgentCard({ className }: AgentCardProps) {
  const flow = useAgentFlow()
  const isExpanded = useAgentExpanded()
  const collapse = useAgentStore((s) => s.collapse)
  const close = useAgentStore((s) => s.close)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmCallback, setConfirmCallback] = useState<(() => void) | null>(null)

  // Click outside to collapse
  const cardRef = useClickOutside<HTMLDivElement>(() => {
    if (isExpanded) {
      collapse()
    }
  }, isExpanded)

  // Handle close request - may be called by child with needsConfirmation info
  const handleCloseRequest = useCallback((needsConfirmation: boolean) => {
    if (needsConfirmation) {
      setConfirmCallback(() => close)
      setShowConfirm(true)
    } else {
      close()
    }
  }, [close])

  const handleConfirmClose = useCallback(() => {
    setShowConfirm(false)
    confirmCallback?.()
    setConfirmCallback(null)
  }, [confirmCallback])

  return (
    <>
      <motion.div
        ref={cardRef}
        layout
        transition={springConfig}
        className={cn(
          'flex flex-col',
          'bg-sidebar border rounded-xl shadow-md',
          'transition-colors duration-150',
          'hover:border-muted-foreground/30',
          'focus-within:border-muted-foreground/30',
          className
        )}
      >
        {/* FIX #5: Conditionally render different content based on flow state */}
        {flow ? (
          <ActiveFlowContent
            flow={flow}
            isExpanded={isExpanded}
            onCloseRequest={handleCloseRequest}
          />
        ) : (
          <IdleContent isExpanded={isExpanded} />
        )}
      </motion.div>

      {/* Confirmation dialog */}
      <ConfirmClose
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={handleConfirmClose}
      />
    </>
  )
}

/**
 * Content when no flow is active.
 * Shows status bar and expandable actions.
 */
function IdleContent({ isExpanded }: { isExpanded: boolean }) {
  return (
    <>
      <AgentStatusBar hasFlow={false} />
      <AgentContent isExpanded={isExpanded}>
        <AgentActions />
      </AgentContent>
    </>
  )
}

/**
 * FIX #5: Separate component that safely calls the flow hook.
 * This component only renders when a flow is active, so the hook
 * is always called (no conditional hook violation).
 */
function ActiveFlowContent({
  flow,
  isExpanded,
  onCloseRequest,
}: {
  flow: NonNullable<AgentFlow>
  isExpanded: boolean
  onCloseRequest: (needsConfirmation: boolean) => void
}) {
  const close = useAgentStore((s) => s.close)
  const registration = getFlowRegistration(flow.type)

  // Flow not registered - show fallback (no hook call needed)
  if (!registration) {
    return (
      <>
        <AgentStatusBar
          hasFlow={true}
          onCloseRequest={() => onCloseRequest(false)}
        />
        <AgentContent isExpanded={isExpanded}>
          <div className="text-sm text-muted-foreground text-center py-4">
            Flow "{flow.type}" is not yet implemented.
          </div>
        </AgentContent>
      </>
    )
  }

  // Flow is registered - render with hook
  // Hook is ALWAYS called here (not conditional) because this component
  // only renders when flow is active AND registered
  //
  // CRITICAL FIX: Add key={flow.type} to force remount when flow type changes.
  // Without this, if flow.type changes (e.g., 'upload' -> 'create-stack'),
  // React preserves the component instance but the hook changes. If the hooks
  // have different numbers of internal hooks, React crashes with:
  // "Rendered more hooks than during the previous render"
  return (
    <FlowErrorBoundary onReset={close}>
      <RegisteredFlowContent
        key={flow.type}
        flow={flow}
        registration={registration}
        isExpanded={isExpanded}
        onCloseRequest={onCloseRequest}
      />
    </FlowErrorBoundary>
  )
}

/**
 * FIX #5: Innermost component that calls the flow hook.
 * Separated to ensure the hook is called at the top level of a component.
 */
function RegisteredFlowContent({
  flow,
  registration,
  isExpanded,
  onCloseRequest,
}: {
  flow: NonNullable<AgentFlow>
  registration: NonNullable<ReturnType<typeof getFlowRegistration>>
  isExpanded: boolean
  onCloseRequest: (needsConfirmation: boolean) => void
}) {
  const close = useAgentStore((s) => s.close)

  // FIX #5: Hook is called unconditionally at component top level
  const hookResult = registration.useHook()

  const { metadata } = registration
  const currentStep = hookResult.step
  const StepComponent = metadata.components[currentStep]
  const stepProps = hookResult.stepProps[currentStep] ?? {}
  const flowIcon = metadata.icons[currentStep]

  const handleCloseClick = useCallback(() => {
    onCloseRequest(hookResult.needsConfirmation)
  }, [hookResult.needsConfirmation, onCloseRequest])

  return (
    <>
      <AgentStatusBar
        hasFlow={true}
        flowIcon={flowIcon}
        showBack={hookResult.canGoBack}
        onBack={hookResult.onBack}
        needsConfirmation={hookResult.needsConfirmation}
        onCloseRequest={handleCloseClick}
      />
      <AgentContent isExpanded={isExpanded}>
        {/* FIX #11: Wrap step component in error boundary */}
        <FlowErrorBoundary onReset={close}>
          {StepComponent ? <StepComponent {...stepProps} /> : null}
        </FlowErrorBoundary>
      </AgentContent>
    </>
  )
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit
```

Expected: No errors (or expected errors for unregistered flows)

**Step 3: Commit**

```bash
git add frontend/components/agent/card/agent-card.tsx && git commit -m "feat(agent): add unified AgentCard component"
```

---

## Task 5: Update Card Barrel Export

**Files:**
- Modify: `frontend/components/agent/card/index.ts`

**Step 1: Update barrel export**

```typescript
// frontend/components/agent/card/index.ts
export { useClickOutside } from './use-click-outside'
export { AgentCard } from './agent-card'
export { AgentStatusBar } from './agent-status-bar'
export { AgentContent } from './agent-content'
export { AgentSteps } from './agent-steps'
export { FlowErrorBoundary } from './flow-error-boundary'
```

**Step 2: Commit**

```bash
git add frontend/components/agent/card/index.ts && git commit -m "chore(agent): update card barrel export"
```

---

## Task 6: Create AgentContainer Component

**Files:**
- Create: `frontend/components/agent/agent-container.tsx` (or modify if it exists)

**Step 1: Check if file exists**

```bash
cat /Users/fraserbrown/stackdocs/frontend/components/agent/agent-container.tsx 2>/dev/null || echo "File does not exist"
```

**Step 2: Create/update the container**

If file exists, read it first. Otherwise create:

```typescript
// frontend/components/agent/agent-container.tsx
'use client'

import { AgentCard } from './card'
import { AgentPopupContent } from './agent-popup-content'
import { useAgentFlow, useAgentExpanded } from './stores/agent-store'

/**
 * Container for the agent card.
 * Positions at bottom of screen and handles layout.
 *
 * During migration: Falls back to old popup content if flow not in registry.
 */
export function AgentContainer() {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-50">
      <AgentCard />
    </div>
  )
}
```

**Step 3: Verify TypeScript compiles**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add frontend/components/agent/agent-container.tsx && git commit -m "feat(agent): update AgentContainer to use unified AgentCard"
```

---

## Task 7: Update Agent Index Barrel

**Files:**
- Modify: `frontend/components/agent/index.ts`

**Step 1: Update exports**

```typescript
// frontend/components/agent/index.ts

// Card components
export { AgentCard, AgentStatusBar, AgentContent, AgentSteps } from './card'

// Container
export { AgentContainer } from './agent-container'

// Actions
export { AgentActions } from './agent-actions'
export { UploadButton } from './upload-button'

// Flows
export { flowRegistry, getFlowRegistration, isFlowRegistered } from './flows/registry'
export type { FlowMetadata, FlowHookResult, FlowRegistration } from './flows/types'
export { springConfig, contentSpringConfig } from './flows/types'

// Store
export {
  useAgentStore,
  useAgentFlow,
  useAgentStatus,
  useAgentExpanded,
  useAgentEvents,
  useAgentPopup, // deprecated, use useAgentExpanded
  initialUploadData,
} from './stores/agent-store'

// Types
export type {
  AgentFlow,
  UploadFlowData,
  UploadFlowStep,
  AgentStatus,
} from './stores/agent-store'

// Legacy exports (to be removed after full migration)
export { AgentBar } from './agent-bar'
export { AgentPopup } from './agent-popup'
```

**Step 2: Verify TypeScript compiles**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add frontend/components/agent/index.ts && git commit -m "chore(agent): update barrel exports for unified card"
```

---

## Task 8: Visual Testing

**Step 1: Start development server**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npm run dev
```

**Step 2: Test scenarios**

1. **Idle state:** Card shows input bar with status icon and chevron
2. **Expand idle:** Click chevron, actions should appear with spring animation
3. **Click outside:** Click anywhere outside card, should collapse
4. **Collapse animation:** Content should animate height to 0 smoothly

**Step 3: Take screenshot or note any issues**

If issues found, create entries in `docs/plans/issues/ACTIVE.md`.

**Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix(agent): address visual issues from Phase 2 testing"
```

---

## Phase 2 Checklist

- [ ] AgentStatusBar with spring animations
- [ ] AgentContent with height animation
- [ ] AgentSteps for progress display
- [ ] AgentCard unified component
- [ ] Click-outside collapse working
- [ ] AgentContainer updated
- [ ] Barrel exports updated
- [ ] Visual testing passed

---

## Next Phase

Continue to [Phase 3: Upload Migration](./phase-3-upload-migration.md) to migrate the existing upload flow to the new pattern.
