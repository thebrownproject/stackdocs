"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AgentAuditLink, EvalRun } from "@/types/agents";
import * as Icons from "@/components/icons";

function shortDate(value: string | null): string {
  return value ? value.slice(0, 10) : "No expiry";
}

export function AuditLinksPanel({
  links,
  runs,
}: {
  links: AgentAuditLink[];
  runs: EvalRun[];
}) {
  const router = useRouter();
  const heldOutRun = runs.find((run) => run.phase === "held_out" && (run.status === "complete" || run.status === "completed"));

  async function createLink() {
    if (!heldOutRun) {
      toast.error("Train the agent first");
      return;
    }
    const res = await fetch("/api/audit-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evalRunId: heldOutRun.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Failed to create link");
      return;
    }
    await navigator.clipboard.writeText(data.url).catch(() => undefined);
    toast.success("Audit link copied");
    router.refresh();
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/audit-links/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to revoke link");
      return;
    }
    toast.success("Audit link revoked");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Audit links</h2>
          <p className="text-xs text-muted-foreground">Shareable reports for prospects.</p>
        </div>
        <Button size="sm" onClick={createLink} disabled={!heldOutRun}>
          <Icons.Plus className="size-4" />
          New link
        </Button>
      </div>
      <div className="divide-y rounded-md border">
        {links.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">No audit links yet.</div>
        ) : (
          links.map((link) => {
            const url = `/audit/${link.token}`;
            return (
              <div key={link.id} className="flex items-center gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <a href={`/audit/${link.token}`} target="_blank" className="block truncate font-mono text-xs text-foreground underline-offset-4 hover:underline">
                    {url}
                  </a>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {link.revoked_at ? "Revoked" : `Expires ${shortDate(link.expires_at)}`} · {link.view_count} views
                  </p>
                </div>
                {!link.revoked_at && (
                  <Button size="icon-sm" variant="ghost" onClick={() => revoke(link.id)}>
                    <Icons.X className="size-4" />
                    <span className="sr-only">Revoke</span>
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
