'use client'

import { useCallback } from 'react'
import { useAgentFlow } from '../../../stores/agent-store'
import type { FlowHookResult } from '../../types'
import type { ManageColumnsFlowStep } from './metadata'

export function useManageColumnsFlow(): FlowHookResult<ManageColumnsFlowStep> {
  const flow = useAgentFlow()

  const step = (flow?.type === 'manage-columns' ? flow.step : 'list') as ManageColumnsFlowStep

  const handleBack = useCallback(() => {
    // TODO: Implement navigation
  }, [])

  return {
    step,
    canGoBack: step === 'edit',
    needsConfirmation: ['list', 'edit'].includes(step),
    onBack: handleBack,
    stepProps: {
      list: {},
      edit: {},
      complete: {},
    },
  }
}
