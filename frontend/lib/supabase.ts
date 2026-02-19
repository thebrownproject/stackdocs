import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Create a Supabase client authenticated with a Clerk session.
 * Use this in client components where you have access to the Clerk session.
 *
 * @param getToken - Async function that returns the Clerk session token
 */
export function createClerkSupabaseClient(
  getToken: () => Promise<string | null>
): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    accessToken: getToken,
    realtime: {
      accessToken: getToken,
    },
  })
}
