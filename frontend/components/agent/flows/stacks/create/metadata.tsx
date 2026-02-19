// frontend/components/agent/flows/stacks/create/metadata.tsx
import * as Icons from '@/components/icons'
import { FlowPlaceholder, type FlowMetadata } from '../../types'

export type CreateStackFlowStep = 'name' | 'documents' | 'complete'

const Placeholder = () => <FlowPlaceholder flowName="Create Stack" />

export const createStackFlowMetadata: FlowMetadata<CreateStackFlowStep> = {
  type: 'create-stack',
  steps: ['name', 'documents', 'complete'] as const,
  icons: {
    name: Icons.Stack,
    documents: Icons.Plus,
    complete: Icons.Check,
  },
  statusText: {
    name: 'Name your stack',
    documents: 'Add documents to stack',
    complete: 'Stack created',
  },
  minimizedText: 'Continue creating stack...',
  components: {
    name: Placeholder,
    documents: Placeholder,
    complete: Placeholder,
  },
  backableSteps: ['documents'] as const,
  confirmationSteps: ['name', 'documents'] as const,
}
