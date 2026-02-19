// frontend/components/agent/flows/tables/manage-columns/metadata.tsx
import * as Icons from '@/components/icons'
import { FlowPlaceholder, type FlowMetadata } from '../../types'

export type ManageColumnsFlowStep = 'list' | 'edit' | 'complete'

const Placeholder = () => <FlowPlaceholder flowName="Manage Columns" />

export const manageColumnsFlowMetadata: FlowMetadata<ManageColumnsFlowStep> = {
  type: 'manage-columns',
  steps: ['list', 'edit', 'complete'] as const,
  icons: {
    list: Icons.List,
    edit: Icons.Edit,
    complete: Icons.Check,
  },
  statusText: {
    list: 'Manage table columns',
    edit: 'Edit column',
    complete: 'Columns updated',
  },
  minimizedText: 'Continue managing columns...',
  components: {
    list: Placeholder,
    edit: Placeholder,
    complete: Placeholder,
  },
  backableSteps: ['edit'] as const,
  confirmationSteps: ['list', 'edit'] as const,
}
