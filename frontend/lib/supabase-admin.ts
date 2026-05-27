import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Service-role Supabase client for server-side route handlers (training,
 * embeddable inference). Bypasses RLS, so callers MUST scope queries by
 * user_id / agent ownership explicitly. Never import this into client code.
 */
export function createAdminSupabaseClient(): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export const DOCUMENTS_BUCKET = "documents";

/** Download a stored file as bytes for direct (no-OCR) model reading. */
export async function downloadFileBytes(
  db: SupabaseClient,
  filePath: string,
): Promise<Uint8Array> {
  const { data, error } = await db.storage.from(DOCUMENTS_BUCKET).download(filePath);
  if (error || !data) {
    throw new Error(`Failed to download ${filePath}: ${error?.message ?? "no data"}`);
  }
  return new Uint8Array(await data.arrayBuffer());
}
