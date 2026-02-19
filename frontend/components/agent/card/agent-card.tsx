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
      <div className={cn('relative', className)}>
        <motion.div
          ref={cardRef}
          layout
          transition={springConfig}
          className={cn(
            'relative flex flex-col',
            'bg-sidebar border rounded-xl',
            'shadow-[0_0_2px_rgba(0,0,0,0.04),0_0_12px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.08),0_8px_32px_rgba(0,0,0,0.1)]',
            'transition-colors duration-150',
            'hover:border-muted-foreground/30',
            'focus-within:border-muted-foreground/30'
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
      </div>

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
            Flow &ldquo;{flow.type}&rdquo; is not yet implemented.
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
  registration,
  isExpanded,
  onCloseRequest,
}: {
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
