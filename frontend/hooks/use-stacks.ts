'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/hooks/use-supabase'
import type { StackSummary } from '@/types/stacks'

// Module-level cache to prevent loading flash on remount
let cache: StackSummary[] | null = null

/**
 * Client-side hook to fetch active stacks.
 * Returns a list of stack summaries (id + name) for use in filters, dropdowns, etc.
 *
 * Uses module-level cache: if cache exists, returns it immediately (no loading state)
 * while still fetching in background to refresh.
 */
export function useStacks() {
  const [stacks, setStacks] = useState<StackSummary[]>(cache ?? [])
  const [loading, setLoading] = useState(!cache)
  const supabase = useSupabase()

  useEffect(() => {
    let ignore = false

    async function fetchStacks() {
      const { data, error } = await supabase
        .from('stacks')
        .select('id, name')
        .eq('status', 'active')
        .order('name', { ascending: true })

      if (!ignore) {
        if (!error && data) {
          cache = data
          setStacks(data)
        }
        setLoading(false)
      }
    }
    fetchStacks()

    return () => {
      ignore = true
    }
  }, [supabase])

  return { stacks, loading }
}
