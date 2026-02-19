// frontend/components/agent/flows/stacks/edit/metadata.tsx
import * as Icons from '@/components/icons'
import { FlowPlaceholder, type FlowMetadata } from '../../types'

export type EditStackFlowStep = 'name' | 'documents' | 'complete'

const Placeholder = () => <FlowPlaceholder flowName="Edit Stack" />

export const editStackFlowMetadata: FlowMetadata<EditStackFlowStep> = {
  type: 'edit-stack',
  steps: ['name', 'documents', 'complete'] as const,
  icons: {
    name: Icons.Edit,
    documents: Icons.Stack,
    complete: Icons.Check,
  },
  statusText: {
    name: 'Edit stack name',
    documents: 'Manage documents',
    complete: 'Stack updated',
  },
  minimizedText: 'Continue editing stack...',
  components: {
    name: Placeholder,
    documents: Placeholder,
    complete: Placeholder,
  },
  backableSteps: ['documents'] as const,
  confirmationSteps: ['name', 'documents'] as const,
}
