'use client'

import { useSession } from '@clerk/nextjs'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { useMemo } from 'react'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * React hook for Supabase client with Clerk authentication.
 * Use this in client components to get an authenticated Supabase client.
 *
 * Usage:
 *   const supabase = useSupabase()
 *   const { data } = await supabase.from('documents').select()
 */
export function useSupabase(): SupabaseClient {
  const { session } = useSession()

  const client = useMemo(() => {
    return createClient(supabaseUrl, supabaseAnonKey, {
      accessToken: async () => {
        const token = await session?.getToken()
        return token ?? null
      },
    })
  }, [session])

  return client
}
