// frontend/lib/queries/stacks.ts

import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type {
  StackSummary,
  StackWithCounts,
  StackWithDetails,
  StackTableRow,
  StackDocument,
} from '@/types/stacks'

/**
 * Get all stacks for the current user with document and table counts.
 */
export async function getStacksWithCounts(): Promise<StackWithCounts[]> {
  const supabase = await createServerSupabaseClient()

  const { data: stacks, error } = await supabase
    .from('stacks')
    .select(`
      id, name, description, status, created_at, updated_at,
      stack_documents(count),
      stack_tables(count)
    `)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching stacks:', error)
    return []
  }

  return (stacks || []).map((stack) => ({
    id: stack.id,
    name: stack.name,
    description: stack.description,
    status: stack.status,
    created_at: stack.created_at,
    updated_at: stack.updated_at,
    document_count: (stack.stack_documents as { count: number }[])?.[0]?.count ?? 0,
    table_count: (stack.stack_tables as { count: number }[])?.[0]?.count ?? 0,
  }))
}

/**
 * Get a single stack with all documents and tables.
 */
export const getStackWithDetails = cache(async function(
  stackId: string
): Promise<StackWithDetails | null> {
  const supabase = await createServerSupabaseClient()

  const { data: stack, error: stackError } = await supabase
    .from('stacks')
    .select('*')
    .eq('id', stackId)
    .single()

  if (stackError || !stack) {
    console.error('Error fetching stack:', stackError)
    return null
  }

  const { data: stackDocs } = await supabase
    .from('stack_documents')
    .select(`
      id, stack_id, document_id, added_at,
      documents (id, filename, mime_type, status, uploaded_at)
    `)
    .eq('stack_id', stackId)
    .order('added_at', { ascending: false })

  const { data: tables } = await supabase
    .from('stack_tables')
    .select('*')
    .eq('stack_id', stackId)
    .order('created_at', { ascending: true })

  const documents: StackDocument[] = (stackDocs || []).map((sd) => ({
    id: sd.id,
    stack_id: sd.stack_id,
    document_id: sd.document_id,
    added_at: sd.added_at,
    document: sd.documents as unknown as StackDocument['document'],
  }))

  return { ...stack, documents, tables: tables || [] }
})

/**
 * Get table rows for a specific stack table.
 */
export const getStackTableRows = cache(async function(
  tableId: string
): Promise<StackTableRow[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('stack_table_rows')
    .select(`
      id, table_id, document_id, row_data, confidence_scores, created_at, updated_at,
      documents (id, filename)
    `)
    .eq('table_id', tableId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching table rows:', error)
    return []
  }

  return (data || []).map((row) => ({
    ...row,
    document: row.documents as unknown as StackTableRow['document'],
  }))
})

/**
 * Get stacks for sidebar (minimal data).
 */
export async function getStacksForSidebar(): Promise<StackSummary[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('stacks')
    .select('id, name')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error fetching stacks for sidebar:', error)
    return []
  }

  return data || []
}
