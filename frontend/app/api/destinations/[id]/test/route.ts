import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { adapterFromDestination } from "@/lib/destinations/resolver";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const db = createAdminSupabaseClient();
  const { data: row } = await db
    .from("destinations")
    .select("id, agent_id, kind, label, config")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Destination not found" }, { status: 404 });

  const adapter = adapterFromDestination(row);
  if (!adapter) return NextResponse.json({ error: "Destination config is invalid" }, { status: 400 });
  const result = await adapter.deliver({
    agentId: row.agent_id,
    documentId: "test-document",
    extractedFields: { vendor: "Acme Supplies", total: 1250.5, invoice_number: "INV-1001" },
    confidenceScores: { vendor: 0.98, total: 0.94, invoice_number: 0.91 },
    minConfidence: 0.91,
  });
  return NextResponse.json({ result });
}
