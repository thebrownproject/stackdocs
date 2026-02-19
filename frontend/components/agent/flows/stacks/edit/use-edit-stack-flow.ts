'use client'

import { useCallback } from 'react'
import { useAgentFlow } from '../../../stores/agent-store'
import type { FlowHookResult } from '../../types'
import type { EditStackFlowStep } from './metadata'

export function useEditStackFlow(): FlowHookResult<EditStackFlowStep> {
  const flow = useAgentFlow()

  const step = (flow?.type === 'edit-stack' ? flow.step : 'name') as EditStackFlowStep

  const handleBack = useCallback(() => {
    // TODO: Implement navigation
  }, [])

  return {
    step,
    canGoBack: step === 'documents',
    needsConfirmation: ['name', 'documents'].includes(step),
    onBack: handleBack,
    stepProps: {
      name: {},
      documents: {},
      complete: {},
    },
  }
}
