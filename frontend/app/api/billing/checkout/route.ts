import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createCheckoutSession } from "@/lib/billing/stripe";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const schema = z.object({ plan: z.enum(["starter", "pro"]) });

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "plan must be starter or pro" }, { status: 400 });

  const db = createAdminSupabaseClient();
  const { data: billing } = await db.rpc("trestle_ensure_billing_period", { p_user_id: userId });
  const user = await currentUser();
  const email = user?.emailAddresses.find((addr) => addr.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const session = await createCheckoutSession({
    userId,
    email,
    plan: parsed.data.plan,
    origin: new URL(req.url).origin,
    stripeCustomerId: billing?.stripe_customer_id ?? null,
  });
  return NextResponse.json(session);
}
