// frontend/components/agent/flows/tables/create/metadata.tsx
import * as Icons from '@/components/icons'
import { FlowPlaceholder, type FlowMetadata } from '../../types'

export type CreateTableFlowStep = 'name' | 'columns' | 'complete'

const Placeholder = () => <FlowPlaceholder flowName="Create Table" />

export const createTableFlowMetadata: FlowMetadata<CreateTableFlowStep> = {
  type: 'create-table',
  steps: ['name', 'columns', 'complete'] as const,
  icons: {
    name: Icons.Table,
    columns: Icons.List,
    complete: Icons.Check,
  },
  statusText: {
    name: 'Name your table',
    columns: 'Define extraction columns',
    complete: 'Table created',
  },
  minimizedText: 'Continue creating table...',
  components: {
    name: Placeholder,
    columns: Placeholder,
    complete: Placeholder,
  },
  backableSteps: ['columns'] as const,
  confirmationSteps: ['name', 'columns'] as const,
}
