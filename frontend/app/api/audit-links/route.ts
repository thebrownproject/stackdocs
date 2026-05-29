import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { generateAuditToken } from "@/lib/audit/tokens";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const createAuditLinkSchema = z.object({
  evalRunId: z.string().uuid(),
  prospectName: z.string().trim().optional(),
  prospectCompany: z.string().trim().optional(),
  prospectEmail: z.string().email().optional(),
  expiresInDays: z.number().int().min(1).max(180).optional(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createAuditLinkSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });

  const db = createAdminSupabaseClient();
  const { data: run } = await db
    .from("eval_runs")
    .select("id, agent_id, user_id")
    .eq("id", parsed.data.evalRunId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!run) return NextResponse.json({ error: "Eval run not found" }, { status: 404 });

  const expiresAt = new Date(Date.now() + (parsed.data.expiresInDays ?? 30) * 24 * 60 * 60 * 1000).toISOString();
  const token = generateAuditToken();
  const { data, error } = await db
    .from("audit_links")
    .insert({
      user_id: userId,
      agent_id: run.agent_id,
      eval_run_id: run.id,
      token,
      prospect_name: parsed.data.prospectName || null,
      prospect_company: parsed.data.prospectCompany || null,
      prospect_email: parsed.data.prospectEmail || null,
      expires_at: expiresAt,
    })
    .select("id, token, expires_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const url = new URL(`/audit/${token}`, req.url).toString();
  return NextResponse.json({ id: data.id, token, url, expiresAt: data.expires_at }, { status: 201 });
}
