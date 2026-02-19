'use client'

import { useCallback } from 'react'
import { useAgentFlow } from '../../../stores/agent-store'
import type { FlowHookResult } from '../../types'
import type { CreateTableFlowStep } from './metadata'

export function useCreateTableFlow(): FlowHookResult<CreateTableFlowStep> {
  const flow = useAgentFlow()

  const step = (flow?.type === 'create-table' ? flow.step : 'name') as CreateTableFlowStep

  const handleBack = useCallback(() => {
    // TODO: Implement navigation
  }, [])

  return {
    step,
    canGoBack: step === 'columns',
    needsConfirmation: ['name', 'columns'].includes(step),
    onBack: handleBack,
    stepProps: {
      name: {},
      columns: {},
      complete: {},
    },
  }
}
