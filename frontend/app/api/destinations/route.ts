import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { destinationConfig } from "@/lib/destinations/validators";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  agentId: z.string().uuid(),
  label: z.string().trim().optional(),
}).and(destinationConfig);

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agentId = new URL(req.url).searchParams.get("agent_id");
  if (!agentId) return NextResponse.json({ error: "agent_id is required" }, { status: 400 });

  const db = createAdminSupabaseClient();
  const { data, error } = await db
    .from("destinations")
    .select("id, agent_id, kind, label, config, enabled, created_at, updated_at")
    .eq("agent_id", agentId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ destinations: data ?? [] });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });

  const db = createAdminSupabaseClient();
  const { data: agent } = await db
    .from("agents")
    .select("id")
    .eq("id", parsed.data.agentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const label = parsed.data.label || parsed.data.kind.replace("_", " ");
  const { data, error } = await db
    .from("destinations")
    .insert({
      user_id: userId,
      agent_id: parsed.data.agentId,
      kind: parsed.data.kind,
      label,
      config: parsed.data.config,
    })
    .select("id, agent_id, kind, label, config, enabled, created_at, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ destination: data }, { status: 201 });
}
