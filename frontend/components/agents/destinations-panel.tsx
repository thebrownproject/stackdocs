"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { DestinationSummary } from "@/types/agents";
import * as Icons from "@/components/icons";

type Kind = "webhook" | "google_sheets" | "email";

function parseJson(value: string, fallback: unknown): unknown {
  if (!value.trim()) return fallback;
  return JSON.parse(value);
}

export function DestinationsPanel({
  agentId,
  destinations,
}: {
  agentId: string;
  destinations: DestinationSummary[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("webhook");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState("");
  const [secret, setSecret] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [sheetName, setSheetName] = useState("Sheet1");
  const [mapping, setMapping] = useState('{"fields.vendor":"A","fields.total":"B"}');
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("New extraction: {{documentId}}");
  const [body, setBody] = useState("Fields: {{fields}}");
  const [busy, setBusy] = useState(false);

  async function createDestination() {
    setBusy(true);
    try {
      const config =
        kind === "webhook"
          ? { url, headers: parseJson(headers, undefined), secret: secret || undefined }
          : kind === "google_sheets"
            ? { spreadsheet_id: spreadsheetId, sheet_name: sheetName, column_mapping: parseJson(mapping, {}) }
            : { to, subject_template: subject, body_template: body };
      const res = await fetch("/api/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, kind, label: label || undefined, config }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to add destination");
      toast.success("Destination added");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add destination");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/destinations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to remove destination");
      return;
    }
    toast.success("Destination removed");
    router.refresh();
  }

  async function test(id: string) {
    const res = await fetch(`/api/destinations/${id}/test`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Test failed");
      return;
    }
    toast[data.result?.ok ? "success" : "error"](data.result?.ok ? "Destination test sent" : data.result?.error ?? "Destination test failed");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-medium">Destinations</h2>
        <p className="text-xs text-muted-foreground">High-confidence results deliver to every enabled destination.</p>
      </div>

      <div className="divide-y rounded-md border">
        {destinations.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">No destinations configured.</div>
        ) : (
          destinations.map((destination) => (
            <div key={destination.id} className="flex items-center gap-3 p-3 text-sm">
              <Badge variant="outline">{destination.kind}</Badge>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{destination.label}</div>
                <div className="truncate font-mono text-xs text-muted-foreground">
                  {JSON.stringify(destination.config)}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => test(destination.id)}>Test</Button>
              <Button size="icon-sm" variant="ghost" onClick={() => remove(destination.id)}>
                <Icons.Trash className="size-4" />
                <span className="sr-only">Remove</span>
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="grid gap-2 rounded-md border bg-muted/30 p-3">
        <div className="grid gap-2 md:grid-cols-[160px_1fr]">
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as Kind)}
            className="h-8 rounded-md border border-input bg-input/45 px-2 text-sm"
          >
            <option value="webhook">Webhook</option>
            <option value="google_sheets">Google Sheets</option>
            <option value="email">Email</option>
          </select>
          <Input placeholder="Label" value={label} onChange={(event) => setLabel(event.target.value)} />
        </div>

        {kind === "webhook" && (
          <>
            <Input placeholder="https://example.com/webhook" value={url} onChange={(event) => setUrl(event.target.value)} />
            <Input placeholder="Signing secret" value={secret} onChange={(event) => setSecret(event.target.value)} />
            <Textarea rows={3} placeholder='{"Authorization":"Bearer token"}' value={headers} onChange={(event) => setHeaders(event.target.value)} className="font-mono text-xs" />
          </>
        )}
        {kind === "google_sheets" && (
          <>
            <Input placeholder="Spreadsheet ID" value={spreadsheetId} onChange={(event) => setSpreadsheetId(event.target.value)} />
            <Input placeholder="Sheet name" value={sheetName} onChange={(event) => setSheetName(event.target.value)} />
            <Textarea rows={3} value={mapping} onChange={(event) => setMapping(event.target.value)} className="font-mono text-xs" />
          </>
        )}
        {kind === "email" && (
          <>
            <Input placeholder="ops@example.com" value={to} onChange={(event) => setTo(event.target.value)} />
            <Input placeholder="Subject template" value={subject} onChange={(event) => setSubject(event.target.value)} />
            <Textarea rows={4} placeholder="Body template" value={body} onChange={(event) => setBody(event.target.value)} />
          </>
        )}

        <Button className="w-fit" size="sm" onClick={createDestination} disabled={busy}>
          {busy ? <Icons.Loader2 className="size-4 animate-spin" /> : <Icons.Plus className="size-4" />}
          Add destination
        </Button>
      </div>
    </div>
  );
}
