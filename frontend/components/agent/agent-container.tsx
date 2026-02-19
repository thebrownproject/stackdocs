// frontend/components/agent/agent-container.tsx
'use client'

import { usePathname } from 'next/navigation'
import { AgentCard } from './card'

// Routes where the agent bar should be visible
const AGENT_ROUTES = ['/documents', '/stacks']

/**
 * Container for the agent card.
 * Positions at bottom of screen and handles layout.
 * Self-manages visibility based on current route.
 */
export function AgentContainer() {
  const pathname = usePathname()

  // Self-managed visibility - only show on supported routes
  const shouldShow = AGENT_ROUTES.some(route => pathname.startsWith(route))
  if (!shouldShow) return null

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-50">
      <AgentCard />
    </div>
  )
}
