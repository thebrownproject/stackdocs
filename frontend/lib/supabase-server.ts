import { auth } from '@clerk/nextjs/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Create a Supabase client for server components/actions.
 * Uses Clerk's server-side auth to get the session token.
 *
 * Usage in Server Components:
 *   const supabase = await createServerSupabaseClient()
 *   const { data } = await supabase.from('documents').select()
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const { getToken } = await auth()
  const token = await getToken()

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    },
  })
}
