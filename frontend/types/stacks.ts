// frontend/types/stacks.ts

export type StackStatus = 'active' | 'archived'
export type TableStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Stack {
  id: string
  name: string
  description: string | null
  status: StackStatus
  created_at: string
  updated_at: string
}

/** Minimal stack info for lists and badges (id + name only) */
export type StackSummary = Pick<Stack, 'id' | 'name'>

export interface StackWithCounts extends Stack {
  document_count: number
  table_count: number
}

export interface StackDocument {
  id: string
  stack_id: string
  document_id: string
  added_at: string
  document: {
    id: string
    filename: string
    mime_type: string
    status: string
    uploaded_at: string
  }
}

export interface StackTableColumn {
  name: string
  description?: string
  type?: 'text' | 'number' | 'date' | 'currency'
}

export interface StackTable {
  id: string
  stack_id: string
  name: string
  mode: 'auto' | 'custom'
  custom_columns: string[] | null
  columns: StackTableColumn[] | null
  session_id: string | null
  status: TableStatus
  created_at: string
  updated_at: string
}

export interface StackTableRow {
  id: string
  table_id: string
  document_id: string
  row_data: Record<string, unknown>
  confidence_scores: Record<string, number> | null
  created_at: string
  updated_at: string
  document: {
    id: string
    filename: string
  }
}

export interface StackWithDetails extends Stack {
  documents: StackDocument[]
  tables: StackTable[]
}
