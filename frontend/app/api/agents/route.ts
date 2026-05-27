import { randomBytes } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateApiKey } from "@/lib/auth/api-key";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// GET /api/agents — list the signed-in user's agents.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminSupabaseClient();
  const { data, error } = await db
    .from("agents")
    .select("id, name, status, active_bundle_version, accuracy_summary, webhook_url, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ agents: data });
}

// POST /api/agents — create a draft agent. Returns the API key once.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { key, hash } = generateApiKey();
  const db = createAdminSupabaseClient();
  const { data, error } = await db
    .from("agents")
    .insert({
      user_id: userId,
      name,
      status: "draft",
      api_key_hash: hash,
      inbound_email_token: randomBytes(6).toString("hex"),
      webhook_url: typeof body.webhookUrl === "string" ? body.webhookUrl : null,
      webhook_secret: typeof body.webhookSecret === "string" ? body.webhookSecret : null,
    })
    .select("id, name, status, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // apiKey is shown only here; we store only its hash.
  return NextResponse.json({ agent: data, apiKey: key }, { status: 201 });
}
