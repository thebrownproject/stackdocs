import { notFound } from "next/navigation";
import { AuditReport } from "@/components/audit/audit-report";
import { getAuditByToken, recordAuditView } from "@/lib/queries/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 text-foreground">
      <div className="max-w-md rounded-md border bg-card p-6">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      </div>
    </main>
  );
}

export default async function AuditPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const audit = await getAuditByToken(token);
  if (!audit) notFound();
  if (audit.link.revoked_at) return <Notice title="Audit revoked" body="This audit link is no longer available." />;
  if (audit.link.expires_at && new Date(audit.link.expires_at) < new Date()) {
    return <Notice title="Audit expired" body="This audit link has expired. Ask for a fresh report link." />;
  }

  recordAuditView(audit.link.id).catch(() => {});
  return <AuditReport audit={audit} />;
}
