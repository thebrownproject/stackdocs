import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// PATCH /api/agents/[id] — update name and webhook delivery settings.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: agentId } = await params;

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
  if ("webhookUrl" in body) update.webhook_url = body.webhookUrl ? String(body.webhookUrl) : null;
  if ("webhookSecret" in body) update.webhook_secret = body.webhookSecret ? String(body.webhookSecret) : null;

  const db = createAdminSupabaseClient();
  const { data, error } = await db
    .from("agents")
    .update(update)
    .eq("id", agentId)
    .eq("user_id", userId)
    .select("id, name, webhook_url")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  return NextResponse.json({ agent: data });
}
