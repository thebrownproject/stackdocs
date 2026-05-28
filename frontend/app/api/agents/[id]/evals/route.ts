import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// GET /api/agents/[id]/evals — eval run history + the promoted accuracy summary.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: agentId } = await params;

  const db = createAdminSupabaseClient();
  const { data: agent } = await db
    .from("agents")
    .select("id, name, status, active_bundle_version, accuracy_summary")
    .eq("id", agentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const { data: runs, error } = await db
    .from("eval_runs")
    .select("id, phase, status, overall_accuracy, per_field_scores, bundle_version, sample_count, started_at, completed_at")
    .eq("agent_id", agentId)
    .order("started_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ agent, runs });
}
