'use client'

import { useCallback } from 'react'
import { useAgentFlow } from '../../../stores/agent-store'
import type { FlowHookResult } from '../../types'
import type { AddDocumentsFlowStep } from './metadata'

export function useAddDocumentsFlow(): FlowHookResult<AddDocumentsFlowStep> {
  const flow = useAgentFlow()

  const step = (flow?.type === 'add-documents' ? flow.step : 'select') as AddDocumentsFlowStep

  const handleBack = useCallback(() => {
    // No back navigation for this flow
  }, [])

  return {
    step,
    canGoBack: false,
    needsConfirmation: ['select', 'uploading'].includes(step),
    onBack: handleBack,
    stepProps: {
      select: {},
      uploading: {},
      complete: {},
    },
  }
}
