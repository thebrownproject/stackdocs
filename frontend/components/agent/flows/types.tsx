// frontend/components/agent/flows/types.tsx

import type { ComponentType } from 'react'

// FIX #7: Use inline type instead of non-existent Icon import
// FIX #2: Use React.ComponentType<any> to allow step components with specific props
// FIX #11: Add shared FlowPlaceholder component for DRY stub flows

/**
 * Icon component type - matches lucide-react icon signature.
 */
export type IconComponent = ComponentType<{ className?: string }>

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
  components: Record<TStep, ComponentType<any>>

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
