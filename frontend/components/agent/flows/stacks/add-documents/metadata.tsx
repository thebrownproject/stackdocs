// frontend/components/agent/flows/stacks/add-documents/metadata.tsx
import * as Icons from '@/components/icons'
import { FlowPlaceholder, type FlowMetadata } from '../../types'

export type AddDocumentsFlowStep = 'select' | 'uploading' | 'complete'

const Placeholder = () => <FlowPlaceholder flowName="Add Documents" />

export const addDocumentsFlowMetadata: FlowMetadata<AddDocumentsFlowStep> = {
  type: 'add-documents',
  steps: ['select', 'uploading', 'complete'] as const,
  icons: {
    select: Icons.Upload,
    uploading: Icons.Loader2,
    complete: Icons.Check,
  },
  statusText: {
    select: 'Select documents to add',
    uploading: 'Adding documents...',
    complete: 'Documents added',
  },
  minimizedText: 'Continue adding documents...',
  components: {
    select: Placeholder,
    uploading: Placeholder,
    complete: Placeholder,
  },
  backableSteps: [] as const,
  confirmationSteps: ['select', 'uploading'] as const,
}
