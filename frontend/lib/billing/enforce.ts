import type { SupabaseClient } from "@supabase/supabase-js";
import { PLANS, reportMeterEvent, type Plan } from "./stripe";

export class QuotaExceededError extends Error {
  constructor(
    public readonly reason: "free_cap_exceeded" | "subscription_inactive",
    public readonly upgradeUrl: string,
  ) {
    super(reason === "free_cap_exceeded" ? "Free plan document cap reached" : "Subscription is not active");
    this.name = "QuotaExceededError";
  }
}

export interface BillingRow {
  user_id: string;
  plan: Plan;
  plan_status: "active" | "past_due" | "canceled" | "trialing";
  stripe_customer_id: string | null;
  docs_processed_current_period: number;
  current_period_started_at: string | null;
  current_period_ends_at: string | null;
}

export interface QuotaCheck {
  allowed: boolean;
  reason?: "free_cap_exceeded" | "subscription_inactive";
  upgradeUrl?: string;
}

const UPGRADE_URL = "/settings/billing";

async function ensurePeriod(db: SupabaseClient, userId: string): Promise<BillingRow> {
  const { data, error } = await db.rpc("trestle_ensure_billing_period", { p_user_id: userId });
  if (error) throw new Error(error.message);
  return data as BillingRow;
}

export async function getBilling(db: SupabaseClient, userId: string): Promise<BillingRow> {
  return ensurePeriod(db, userId);
}

export async function checkQuota(db: SupabaseClient, userId: string): Promise<QuotaCheck> {
  const row = await ensurePeriod(db, userId);
  if (row.plan !== "free" && row.plan_status !== "active" && row.plan_status !== "trialing") {
    return { allowed: false, reason: "subscription_inactive", upgradeUrl: UPGRADE_URL };
  }
  if (row.plan === "free" && row.docs_processed_current_period >= PLANS.free.docsIncluded) {
    return { allowed: false, reason: "free_cap_exceeded", upgradeUrl: UPGRADE_URL };
  }
  return { allowed: true };
}

export async function recordUsage(db: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await db.rpc("trestle_increment_usage", { p_user_id: userId });
  if (error) throw new Error(error.message);
  const row = data as BillingRow;
  const plan = PLANS[row.plan];
  if (row.docs_processed_current_period > plan.docsIncluded) {
    await reportMeterEvent({
      userId,
      stripeCustomerId: row.stripe_customer_id,
      plan: row.plan,
    });
  }
}

export function assertQuotaAllowed(check: QuotaCheck): void {
  if (!check.allowed && check.reason) {
    throw new QuotaExceededError(check.reason, check.upgradeUrl ?? UPGRADE_URL);
  }
}
