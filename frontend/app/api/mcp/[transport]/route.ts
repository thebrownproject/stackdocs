// MCP server — exposes Trestle extraction as a tool so AI-native customers'
// agents (Claude, Cursor, etc.) can call it. Streamable HTTP transport at
// /api/mcp/mcp. Auth: Bearer <agent api key>, same key as /api/extract.

import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { z } from "zod";
import { processDocument } from "@/lib/agent/process";
import { hashApiKey } from "@/lib/auth/api-key";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "extract_document",
      "Extract structured fields from a document (by URL) using this agent's tuned bundle. " +
        "Returns the extracted fields, per-field confidence, and whether the result was auto-delivered " +
        "or routed to human review.",
      {
        fileUrl: z.string().url().describe("Publicly fetchable URL of the document (PDF or image)."),
        mediaType: z.string().optional().describe("MIME type, e.g. application/pdf. Defaults to application/pdf."),
        filename: z.string().optional().describe("Original filename, used to detect convertible formats."),
      },
      async ({ fileUrl, mediaType, filename }, extra) => {
        const agentId = (extra.authInfo?.extra?.agentId as string | undefined) ?? undefined;
        if (!agentId) {
          return { isError: true, content: [{ type: "text", text: "Unauthorized" }] };
        }

        const db = createAdminSupabaseClient();
        const { data: agent } = await db
          .from("agents")
          .select("id, user_id, active_bundle_version, webhook_url, webhook_secret")
          .eq("id", agentId)
          .maybeSingle();
        if (!agent?.active_bundle_version) {
          return { isError: true, content: [{ type: "text", text: "Agent has no trained bundle" }] };
        }

        const { data: bundle } = await db
          .from("agent_bundles")
          .select("field_schema, rules, few_shot_sample_ids, calibration_map")
          .eq("agent_id", agent.id)
          .eq("version", agent.active_bundle_version)
          .maybeSingle();
        if (!bundle) {
          return { isError: true, content: [{ type: "text", text: "Active bundle missing" }] };
        }

        const mime = mediaType ?? "application/pdf";
        const result = await processDocument(db, agent, bundle, {
          file: { data: fileUrl, mediaType: mime },
          filename: filename ?? "document",
          storedPath: fileUrl,
          fileSize: 0,
          mimeType: mime,
        });

        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      },
    );
  },
  { serverInfo: { name: "trestle", version: "1.0.0" } },
  { basePath: "/api/mcp", disableSse: true, maxDuration: 300 },
);

// Authenticate every MCP request by the agent API key (hashed match on agents).
async function verifyToken(_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;
  const db = createAdminSupabaseClient();
  const { data: agent } = await db
    .from("agents")
    .select("id")
    .eq("api_key_hash", hashApiKey(bearerToken))
    .maybeSingle();
  if (!agent) return undefined;
  return { token: bearerToken, clientId: agent.id, scopes: [], extra: { agentId: agent.id } };
}

const authed = withMcpAuth(handler, verifyToken, { required: true });

export { authed as GET, authed as POST, authed as DELETE };
