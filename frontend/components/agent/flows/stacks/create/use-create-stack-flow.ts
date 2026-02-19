'use client'

import { useCallback } from 'react'
import { useAgentFlow } from '../../../stores/agent-store'
import type { FlowHookResult } from '../../types'
import type { CreateStackFlowStep } from './metadata'

export function useCreateStackFlow(): FlowHookResult<CreateStackFlowStep> {
  const flow = useAgentFlow()

  const step = (flow?.type === 'create-stack' ? flow.step : 'name') as CreateStackFlowStep

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
