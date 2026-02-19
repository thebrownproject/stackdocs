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
