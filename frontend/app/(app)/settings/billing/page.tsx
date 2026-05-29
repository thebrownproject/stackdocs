import { auth } from "@clerk/nextjs/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BillingPanel } from "@/components/agents/billing-panel";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import type { BillingSummary } from "@/types/agents";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const { userId } = await auth();
  const db = createAdminSupabaseClient();
  const { data } = userId
    ? await db.rpc("trestle_ensure_billing_period", { p_user_id: userId })
    : { data: null };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-medium">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Plan, quota, and subscription controls.</p>
      </div>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-sm">Current plan</CardTitle>
        </CardHeader>
        <CardContent>
          <BillingPanel billing={data as BillingSummary | null} />
        </CardContent>
      </Card>
    </div>
  );
}
