"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as Icons from "@/components/icons";
import { ApiKeyReveal } from "@/components/agents/api-key-reveal";
import { inboundAddress } from "@/lib/inbound";

interface Props {
  agentId: string;
  hasApiKey: boolean;
  webhookUrl: string | null;
  hasWebhookSecret: boolean;
  inboundToken: string | null;
  hasActiveBundle: boolean;
}

export function ConnectionPanel({
  agentId,
  hasApiKey,
  webhookUrl,
  hasWebhookSecret,
  inboundToken,
  hasActiveBundle,
}: Props) {
  const [rotatedKey, setRotatedKey] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [url, setUrl] = useState(webhookUrl ?? "");
  const [secret, setSecret] = useState("");
  const [savingHook, setSavingHook] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const email = inboundAddress(inboundToken);

  async function rotate() {
    setRotating(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/rotate-key`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setRotatedKey(data.apiKey);
      toast.success("New API key issued — the old key is revoked");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setRotating(false);
    }
  }

  async function saveWebhook() {
    setSavingHook(true);
    try {
      const body: Record<string, unknown> = { webhookUrl: url || null };
      if (secret) body.webhookSecret = secret;
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSecret("");
      toast.success("Delivery settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSavingHook(false);
    }
  }

  async function processFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a document");
      return;
    }
    setProcessing(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/agents/${agentId}/process`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Processing failed");
      setResult(data);
      toast.success(`Processed — ${data.status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setProcessing(false);
    }
  }

  async function copyEmail() {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      toast.success("Address copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <div className="flex flex-col gap-5 text-sm">
      {/* API key */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-medium">API key</span>
          <Button size="sm" variant="outline" onClick={rotate} disabled={rotating}>
            {hasApiKey ? "Rotate key" : "Generate key"}
          </Button>
        </div>
        {rotatedKey ? (
          <ApiKeyReveal apiKey={rotatedKey} />
        ) : (
          <p className="text-xs text-muted-foreground">
            {hasApiKey
              ? "A key is configured (stored as a hash). Rotate to issue a new one."
              : "No key yet. Generate one to call /api/extract."}
          </p>
        )}
        <code className="rounded-md border bg-muted/40 p-2 font-mono text-xs">
          POST /api/extract — Authorization: Bearer &lt;key&gt; — multipart file
        </code>
      </div>

      {/* Webhook */}
      <div className="flex flex-col gap-2">
        <span className="font-medium">Webhook delivery</span>
        <Input placeholder="https://your-system.example/hook" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Input
          type="password"
          placeholder={hasWebhookSecret ? "•••••••• (set — leave blank to keep)" : "Signing secret (optional)"}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
        />
        <Button size="sm" variant="outline" className="w-fit" onClick={saveWebhook} disabled={savingHook}>
          Save delivery settings
        </Button>
        <p className="text-xs text-muted-foreground">
          High-confidence results POST here; low-confidence ones go to the review queue instead.
        </p>
      </div>

      {/* Inbound email (stub) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">Email-in</span>
          <Badge variant="outline">coming soon</Badge>
        </div>
        {email ? (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
            <code className="flex-1 truncate font-mono text-xs">{email}</code>
            <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={copyEmail}>
              <Icons.Json className="size-4" />
              <span className="sr-only">Copy</span>
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Address is assigned when the agent is created.</p>
        )}
        <p className="text-xs text-muted-foreground">
          Forwarding documents to this address will process them automatically (delivery not yet enabled).
        </p>
      </div>

      {/* Manual upload */}
      <div className="flex flex-col gap-2">
        <span className="font-medium">Process a document</span>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
        />
        <Button
          size="sm"
          variant="outline"
          className="w-fit"
          onClick={processFile}
          disabled={processing || !hasActiveBundle}
        >
          {processing ? <Icons.Loader2 className="size-4 animate-spin" /> : <Icons.Upload className="size-4" />}
          Run through agent
        </Button>
        {!hasActiveBundle && <p className="text-xs text-muted-foreground">Train the agent first.</p>}
        {result && (
          <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
