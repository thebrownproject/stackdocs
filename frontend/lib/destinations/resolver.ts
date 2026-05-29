import { createHmac, createSign } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { postWithRetry, type DeliveryResult } from "@/lib/adapters/http";
import { getPathValue, renderTemplate } from "./template";
import { destinationConfig } from "./validators";

export interface DeliveryContext {
  agentId: string;
  documentId: string;
  extractedFields: Record<string, unknown>;
  confidenceScores: Record<string, unknown>;
  minConfidence: number;
}

export interface DestinationAdapter {
  id?: string;
  label: string;
  deliver(ctx: DeliveryContext): Promise<DeliveryResult>;
}

interface DestinationRow {
  id: string;
  kind: string;
  label: string | null;
  config: unknown;
}

function contextData(ctx: DeliveryContext): Record<string, unknown> {
  return {
    agentId: ctx.agentId,
    documentId: ctx.documentId,
    fields: ctx.extractedFields,
    confidence: ctx.confidenceScores,
    minConfidence: ctx.minConfidence,
  };
}

function webhookDestination(id: string | undefined, label: string, config: Record<string, unknown>): DestinationAdapter {
  return {
    id,
    label,
    async deliver(ctx) {
      const body = typeof config.payload_template === "string"
        ? renderTemplate(config.payload_template, contextData(ctx))
        : JSON.stringify(ctx);
      const headers = { ...((config.headers as Record<string, string> | undefined) ?? {}) };
      if (typeof config.secret === "string" && config.secret) {
        headers["X-Trestle-Signature"] = createHmac("sha256", config.secret).update(body).digest("hex");
      }
      return postWithRetry(String(config.url), body, { headers });
    },
  };
}

function columnIndex(column: string): number {
  return column.split("").reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function parseServiceAccount(): { client_email: string; private_key: string } | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(json) as { client_email?: string; private_key?: string };
    if (!parsed.client_email || !parsed.private_key) return null;
    return { client_email: parsed.client_email, private_key: parsed.private_key };
  } catch {
    return null;
  }
}

async function getGoogleAccessToken(): Promise<string> {
  const account = parseServiceAccount();
  if (!account) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is missing or invalid");

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(account.private_key, "base64url")}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.access_token !== "string") {
    throw new Error(typeof data.error_description === "string" ? data.error_description : "Google auth failed");
  }
  return data.access_token;
}

function googleSheetsDestination(id: string | undefined, label: string, config: Record<string, unknown>): DestinationAdapter {
  return {
    id,
    label,
    async deliver(ctx) {
      try {
        const mapping = config.column_mapping as Record<string, string>;
        const maxIndex = Math.max(...Object.values(mapping).map(columnIndex));
        const row = Array.from({ length: maxIndex + 1 }, () => "");
        for (const [path, column] of Object.entries(mapping)) {
          const value = getPathValue({ fields: ctx.extractedFields, confidence: ctx.confidenceScores }, path);
          row[columnIndex(column)] = value == null ? "" : String(value);
        }

        const token = await getGoogleAccessToken();
        const range = encodeURIComponent(`${String(config.sheet_name)}!A:ZZ`);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${String(config.spreadsheet_id)}/values/${range}:append?valueInputOption=USER_ENTERED`;
        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ values: [row] }),
        });
        const data = await res.text();
        return {
          ok: res.ok,
          status: res.status,
          attempts: 1,
          error: res.ok ? undefined : data.slice(0, 500),
        };
      } catch (err) {
        return { ok: false, status: 0, attempts: 1, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}

function emailDestination(id: string | undefined, label: string, config: Record<string, unknown>): DestinationAdapter {
  return {
    id,
    label,
    async deliver(ctx) {
      const apiKey = process.env.RESEND_API_KEY;
      const from = process.env.RESEND_FROM_EMAIL;
      if (!apiKey || !from) {
        return { ok: false, status: 0, attempts: 1, error: "RESEND_API_KEY and RESEND_FROM_EMAIL are required" };
      }

      const data = contextData(ctx);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [String(config.to)],
          cc: Array.isArray(config.cc) ? config.cc : undefined,
          subject: renderTemplate(String(config.subject_template), data),
          text: renderTemplate(String(config.body_template), data),
        }),
      });
      const body = await res.text();
      return {
        ok: res.ok,
        status: res.status,
        attempts: 1,
        error: res.ok ? undefined : body.slice(0, 500),
      };
    },
  };
}

export function adapterFromDestination(row: DestinationRow): DestinationAdapter | null {
  const parsed = destinationConfig.safeParse({ kind: row.kind, config: row.config });
  if (!parsed.success) return null;
  const label = row.label || row.kind;
  if (parsed.data.kind === "webhook") return webhookDestination(row.id, label, parsed.data.config);
  if (parsed.data.kind === "google_sheets") return googleSheetsDestination(row.id, label, parsed.data.config);
  return emailDestination(row.id, label, parsed.data.config);
}

export async function resolveDestinations(db: SupabaseClient, agentId: string): Promise<DestinationAdapter[]> {
  const { data } = await db
    .from("destinations")
    .select("id, kind, label, config")
    .eq("agent_id", agentId)
    .eq("enabled", true)
    .order("created_at", { ascending: true });
  return ((data ?? []) as DestinationRow[]).map(adapterFromDestination).filter((adapter): adapter is DestinationAdapter => Boolean(adapter));
}

export async function deliverAll(
  adapters: DestinationAdapter[],
  ctx: DeliveryContext,
): Promise<Array<DeliveryResult & { label: string }>> {
  return Promise.all(
    adapters.map(async (adapter) => ({
      ...(await adapter.deliver(ctx)),
      label: adapter.label,
    })),
  );
}
