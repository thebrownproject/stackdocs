import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { PLANS, type Plan } from "@/lib/billing/stripe";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

interface StripeEvent {
  type: string;
  data: { object: Record<string, unknown> };
}

function verifyStripeSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const parts = Object.fromEntries(signature.split(",").map((part) => part.split("=") as [string, string]));
  const timestamp = parts.t;
  const received = parts.v1;
  if (!timestamp || !received) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

function planFromPrice(priceId: string | undefined): Plan {
  if (priceId && PLANS.pro.stripePriceId === priceId) return "pro";
  if (priceId && PLANS.starter.stripePriceId === priceId) return "starter";
  return "free";
}

async function getSubscription(subscriptionId: string): Promise<Record<string, unknown> | null> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${secret}`, "Stripe-Version": "2024-12-18.acacia" },
  });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as Record<string, unknown> | null;
}

function periodDate(seconds: unknown): string | null {
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;
}

function planStatus(status: unknown): "active" | "past_due" | "canceled" | "trialing" {
  if (status === "trialing") return "trialing";
  if (status === "past_due" || status === "unpaid" || status === "incomplete" || status === "incomplete_expired") {
    return "past_due";
  }
  if (status === "canceled") return "canceled";
  return "active";
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  if (!verifyStripeSignature(rawBody, req.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody) as StripeEvent;
  const db = createAdminSupabaseClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = (session.metadata as Record<string, unknown> | undefined)?.user_id;
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
    if (typeof userId === "string") {
      const subscription = subscriptionId ? await getSubscription(subscriptionId) : null;
      const item = (((subscription?.items as Record<string, unknown> | undefined)?.data as unknown[]) ?? [])[0] as
        | Record<string, unknown>
        | undefined;
      const priceId = ((item?.price as Record<string, unknown> | undefined)?.id as string | undefined) ?? undefined;
      await db.from("user_billing").upsert({
        user_id: userId,
        plan: planFromPrice(priceId),
        plan_status: "active",
        stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
        stripe_subscription_id: subscriptionId,
        current_period_started_at: periodDate(subscription?.current_period_start),
        current_period_ends_at: periodDate(subscription?.current_period_end),
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object;
    const userId = (subscription.metadata as Record<string, unknown> | undefined)?.user_id;
    const item = (((subscription.items as Record<string, unknown> | undefined)?.data as unknown[]) ?? [])[0] as
      | Record<string, unknown>
      | undefined;
    const priceId = ((item?.price as Record<string, unknown> | undefined)?.id as string | undefined) ?? undefined;
    if (typeof userId === "string") {
      await db
        .from("user_billing")
        .update({
          plan: event.type === "customer.subscription.deleted" ? "free" : planFromPrice(priceId),
          plan_status: event.type === "customer.subscription.deleted" ? "canceled" : planStatus(subscription.status),
          stripe_subscription_id: typeof subscription.id === "string" ? subscription.id : null,
          current_period_started_at: periodDate(subscription.current_period_start),
          current_period_ends_at: periodDate(subscription.current_period_end),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    }
  }

  return NextResponse.json({ received: true });
}
