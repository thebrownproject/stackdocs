import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createPortalSession } from "@/lib/billing/stripe";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminSupabaseClient();
  const { data: billing } = await db.rpc("trestle_ensure_billing_period", { p_user_id: userId });
  if (!billing?.stripe_customer_id) {
    return NextResponse.json({ error: "No Stripe customer for this account" }, { status: 409 });
  }
  const session = await createPortalSession({
    stripeCustomerId: billing.stripe_customer_id,
    origin: new URL(req.url).origin,
  });
  return NextResponse.json(session);
}
