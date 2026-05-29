import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { destinationConfig } from "@/lib/destinations/validators";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  label: z.string().trim().optional(),
  enabled: z.boolean().optional(),
  kind: z.enum(["webhook", "google_sheets", "email"]).optional(),
  config: z.unknown().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  if ((parsed.data.kind === undefined) !== (parsed.data.config === undefined)) {
    return NextResponse.json({ error: "kind and config must be provided together" }, { status: 400 });
  }
  if (parsed.data.kind && !destinationConfig.safeParse({ kind: parsed.data.kind, config: parsed.data.config }).success) {
    return NextResponse.json({ error: "Destination config is invalid" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.label !== undefined) update.label = parsed.data.label;
  if (parsed.data.enabled !== undefined) update.enabled = parsed.data.enabled;
  if (parsed.data.kind !== undefined) update.kind = parsed.data.kind;
  if (parsed.data.config !== undefined) update.config = parsed.data.config;

  const db = createAdminSupabaseClient();
  const { data, error } = await db
    .from("destinations")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, agent_id, kind, label, config, enabled, created_at, updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Destination not found" }, { status: 404 });
  return NextResponse.json({ destination: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const db = createAdminSupabaseClient();
  const { data, error } = await db
    .from("destinations")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Destination not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
