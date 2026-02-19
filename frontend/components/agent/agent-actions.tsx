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
      flow: { type: 'create-stack', step: 'name' },
      tooltip: 'Create a new document stack',
    },
  ],
  '/documents/[id]': [
    {
      id: 're-extract',
      label: 'Re-extract',
      icon: Icons.Refresh,
      flow: { type: 'extract-document', documentId: '', step: 'select' }, // documentId filled at runtime
      tooltip: 'Re-extract data from this document',
    },
  ],
  '/stacks': [
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
      flow: { type: 'create-stack', step: 'name' },
      tooltip: 'Create a new stack',
    },
  ],
  '/stacks/[id]': [
    {
      id: 'add-documents',
      label: 'Add Documents',
      icon: Icons.Plus,
      flow: { type: 'add-documents', stackId: '', step: 'select' }, // stackId filled at runtime
      tooltip: 'Add documents to this stack',
    },
    {
      id: 'create-table',
      label: 'Create Table',
      icon: Icons.Table,
      flow: { type: 'create-table', stackId: '', step: 'name' }, // stackId filled at runtime
      tooltip: 'Create an extraction table',
    },
  ],
}

export function AgentActions() {
  const pathname = usePathname()
  const openFlow = useAgentStore((s) => s.openFlow)

  const actions = getActionsForRoute(pathname)

  if (actions.length === 0) return null

  return (
    <div className="flex items-center gap-1">
      {actions.map((action) => (
        <ActionButton
          key={action.id}
          icon={<action.icon />}
          tooltip={action.tooltip}
          onClick={() => openFlow(action.flow)}
        >
          {action.label}
        </ActionButton>
      ))}
    </div>
  )
}

/**
 * Get actions for the current route.
 *
 * FIX #9: TODO - Dynamic route flows have empty IDs (documentId, stackId).
 * When implementing these flows, need to:
 * 1. Extract ID from pathname (e.g., /documents/abc123 -> abc123)
 * 2. Clone the flow object and fill in the ID
 *
 * Example fix:
 * ```
 * const documentMatch = pathname.match(/^\/documents\/([^/]+)$/)
 * if (documentMatch) {
 *   const documentId = documentMatch[1]
 *   return ACTION_CONFIG['/documents/[id]'].map(action => ({
 *     ...action,
 *     flow: { ...action.flow, documentId }
 *   }))
 * }
 * ```
 */
function getActionsForRoute(pathname: string): ActionDef[] {
  // Try exact match first
  if (ACTION_CONFIG[pathname]) {
    return ACTION_CONFIG[pathname]
  }

  // Try prefix match for dynamic routes
  // TODO FIX #9: Extract documentId/stackId from pathname and inject into flow
  if (pathname.startsWith('/documents/') && pathname !== '/documents') {
    return ACTION_CONFIG['/documents/[id]'] || []
  }

  if (pathname.startsWith('/stacks/') && pathname !== '/stacks') {
    return ACTION_CONFIG['/stacks/[id]'] || []
  }

  // Fallback to documents actions
  return ACTION_CONFIG['/documents'] || []
}
