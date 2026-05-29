"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BillingSummary } from "@/types/agents";

const INCLUDED = { free: 25, starter: 1000, pro: 5000 };

export function BillingPanel({ billing }: { billing: BillingSummary | null }) {
  const plan = billing?.plan ?? "free";
  const used = billing?.docs_processed_current_period ?? 0;
  const included = INCLUDED[plan];

  async function checkout(nextPlan: "starter" | "pro") {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: nextPlan }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data.url !== "string") {
      toast.error(data.error ?? "Checkout failed");
      return;
    }
    window.location.href = data.url;
  }

  async function portal() {
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data.url !== "string") {
      toast.error(data.error ?? "Portal unavailable");
      return;
    }
    window.location.href = data.url;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Billing</h2>
          <p className="text-xs text-muted-foreground">{used} of {included} included docs used this period.</p>
        </div>
        <Badge variant="outline">{plan}</Badge>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${Math.min(100, (used / included) * 100)}%` }} />
      </div>
      <div className="flex flex-wrap gap-2">
        {plan === "free" ? (
          <>
            <Button size="sm" onClick={() => checkout("starter")}>Starter</Button>
            <Button size="sm" variant="outline" onClick={() => checkout("pro")}>Pro</Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={portal}>Manage subscription</Button>
        )}
      </div>
    </div>
  );
}
