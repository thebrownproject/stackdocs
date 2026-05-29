export type Plan = "free" | "starter" | "pro";

export interface PlanDefinition {
  name: string;
  monthlyPriceUsd: number;
  docsIncluded: number;
  perDocOverageUsd: number;
  stripePriceId: string | null;
  meterEventName: string | null;
}

export const PLANS: Record<Plan, PlanDefinition> = {
  free: {
    name: "Free",
    monthlyPriceUsd: 0,
    docsIncluded: 25,
    perDocOverageUsd: 0,
    stripePriceId: null,
    meterEventName: null,
  },
  starter: {
    name: "Starter",
    monthlyPriceUsd: 500,
    docsIncluded: 1000,
    perDocOverageUsd: 0.3,
    stripePriceId: process.env.STRIPE_PRICE_STARTER ?? null,
    meterEventName: "trestle_doc_processed_starter",
  },
  pro: {
    name: "Pro",
    monthlyPriceUsd: 1500,
    docsIncluded: 5000,
    perDocOverageUsd: 0.2,
    stripePriceId: process.env.STRIPE_PRICE_PRO ?? null,
    meterEventName: "trestle_doc_processed_pro",
  },
};

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

async function stripeRequest<T>(path: string, body: URLSearchParams): Promise<T> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("STRIPE_SECRET_KEY is not configured");

  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-12-18.acacia",
    },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message ?? `Stripe request failed: ${res.status}`);
  return data;
}

export async function createCheckoutSession(opts: {
  userId: string;
  email?: string | null;
  plan: Exclude<Plan, "free">;
  origin: string;
  stripeCustomerId?: string | null;
}): Promise<{ url: string }> {
  const price = PLANS[opts.plan].stripePriceId;
  if (!price) throw new Error(`Stripe price is not configured for ${opts.plan}`);

  const body = new URLSearchParams({
    mode: "subscription",
    success_url: `${opts.origin}/settings/billing?success=1`,
    cancel_url: `${opts.origin}/settings/billing`,
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    "metadata[user_id]": opts.userId,
    "subscription_data[metadata][user_id]": opts.userId,
    "subscription_data[metadata][plan]": opts.plan,
  });
  if (opts.stripeCustomerId) body.set("customer", opts.stripeCustomerId);
  else if (opts.email) body.set("customer_email", opts.email);

  const session = await stripeRequest<{ url?: string }>("checkout/sessions", body);
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url };
}

export async function createPortalSession(opts: { stripeCustomerId: string; origin: string }): Promise<{ url: string }> {
  const session = await stripeRequest<{ url?: string }>(
    "billing_portal/sessions",
    new URLSearchParams({
      customer: opts.stripeCustomerId,
      return_url: `${opts.origin}/settings/billing`,
    }),
  );
  if (!session.url) throw new Error("Stripe did not return a portal URL");
  return { url: session.url };
}

export async function reportMeterEvent(opts: {
  userId: string;
  stripeCustomerId: string | null;
  plan: Plan;
}): Promise<void> {
  const eventName = PLANS[opts.plan].meterEventName;
  if (!eventName || !opts.stripeCustomerId || !stripeConfigured()) return;

  await stripeRequest(
    "billing/meter_events",
    new URLSearchParams({
      event_name: eventName,
      "payload[value]": "1",
      "payload[stripe_customer_id]": opts.stripeCustomerId,
      identifier: `${opts.userId}-${Date.now()}`,
    }),
  );
}
