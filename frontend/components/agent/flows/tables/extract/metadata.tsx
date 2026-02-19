// frontend/components/agent/flows/tables/extract/metadata.tsx
import * as Icons from '@/components/icons'
import { FlowPlaceholder, type FlowMetadata } from '../../types'

export type ExtractTableFlowStep = 'configure' | 'extracting' | 'complete'

const Placeholder = () => <FlowPlaceholder flowName="Extract Table" />

export const extractTableFlowMetadata: FlowMetadata<ExtractTableFlowStep> = {
  type: 'extract-table',
  steps: ['configure', 'extracting', 'complete'] as const,
  icons: {
    configure: Icons.Settings,
    extracting: Icons.Loader2,
    complete: Icons.Check,
  },
  statusText: {
    configure: 'Configure batch extraction',
    extracting: 'Extracting from documents...',
    complete: 'Extraction complete',
  },
  minimizedText: 'Continue batch extraction...',
  components: {
    configure: Placeholder,
    extracting: Placeholder,
    complete: Placeholder,
  },
  backableSteps: [] as const,
  confirmationSteps: ['configure', 'extracting'] as const,
}
