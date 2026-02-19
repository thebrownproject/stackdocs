'use client'

import { useCallback } from 'react'
import { useAgentFlow } from '../../../stores/agent-store'
import type { FlowHookResult } from '../../types'
import type { ExtractFlowStep } from './metadata'

export function useExtractFlow(): FlowHookResult<ExtractFlowStep> {
  const flow = useAgentFlow()

  const step = (flow?.type === 'extract-document' ? flow.step : 'select') as ExtractFlowStep

  const handleBack = useCallback(() => {
    // No back navigation for this flow
  }, [])

  return {
    step,
    canGoBack: false,
    needsConfirmation: step === 'extracting',
    onBack: handleBack,
    stepProps: {
      select: {},
      extracting: {},
      complete: {},
    },
  }
}
