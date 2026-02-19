'use client'

import { useCallback } from 'react'
import { useAgentFlow } from '../../../stores/agent-store'
import type { FlowHookResult } from '../../types'
import type { ExtractTableFlowStep } from './metadata'

export function useExtractTableFlow(): FlowHookResult<ExtractTableFlowStep> {
  const flow = useAgentFlow()

  const step = (flow?.type === 'extract-table' ? flow.step : 'configure') as ExtractTableFlowStep

  const handleBack = useCallback(() => {
    // No back navigation for this flow
  }, [])

  return {
    step,
    canGoBack: false,
    needsConfirmation: ['configure', 'extracting'].includes(step),
    onBack: handleBack,
    stepProps: {
      configure: {},
      extracting: {},
      complete: {},
    },
  }
}
