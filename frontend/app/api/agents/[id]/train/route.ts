import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { runTraining } from "@/lib/harness/orchestrator";
import { sseResponse } from "@/lib/sse";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // training streams but the function still has a wall-clock cap

// POST /api/agents/[id]/train — runs the training loop, streaming progress as SSE.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: agentId } = await params;

  const db = createAdminSupabaseClient();
  const { data: agent } = await db
    .from("agents")
    .select("id")
    .eq("id", agentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  return sseResponse(runTraining({ agentId, userId, db }));
}
