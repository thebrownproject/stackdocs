import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateApiKey } from "@/lib/auth/api-key";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// POST /api/agents/[id]/rotate-key — issue a new API key (shown once), revoking the old one.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: agentId } = await params;

  const { key, hash } = generateApiKey();
  const db = createAdminSupabaseClient();
  const { data, error } = await db
    .from("agents")
    .update({ api_key_hash: hash, updated_at: new Date().toISOString() })
    .eq("id", agentId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  return NextResponse.json({ apiKey: key });
}
