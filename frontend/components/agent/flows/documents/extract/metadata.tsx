// frontend/components/agent/flows/documents/extract/metadata.ts
import * as Icons from '@/components/icons'
import { FlowPlaceholder, type FlowMetadata } from '../../types'

export type ExtractFlowStep = 'select' | 'extracting' | 'complete'

// FIX #11: Use shared FlowPlaceholder instead of repeating the same component
const Placeholder = () => <FlowPlaceholder flowName="Extract Document" />

export const extractFlowMetadata: FlowMetadata<ExtractFlowStep> = {
  type: 'extract-document',
  steps: ['select', 'extracting', 'complete'] as const,
  icons: {
    select: Icons.Refresh,
    extracting: Icons.Loader2,
    complete: Icons.Check,
  },
  statusText: {
    select: 'Select extraction options',
    extracting: 'Re-extracting document...',
    complete: 'Extraction complete',
  },
  minimizedText: 'Continue extraction...',
  components: {
    select: Placeholder,
    extracting: Placeholder,
    complete: Placeholder,
  },
  backableSteps: [] as const,
  confirmationSteps: ['extracting'] as const,
}
