// frontend/components/agent/card/agent-steps.tsx
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'
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
