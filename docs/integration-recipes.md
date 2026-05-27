# Integration recipes

Trestle is forward-deployed: the agent + harness are shared, the **edges are
wired per customer**. These are the building blocks for an engagement — pick a
source, pick a destination, and (when needed) register custom tools/adapters.

```
SOURCE → tuned agent → DESTINATION
API / upload / email / MCP        signed webhook / customer API / review queue
```

Every result is routed by **calibrated confidence**: high-confidence results go
to the destination; low-confidence ones land in the review queue, and the human
correction becomes a new labelled sample.

---

## Inputs

### Supported formats
- **Direct (read natively):** PDF, PNG, JPEG, WebP, GIF.
- **Converted to text first:** DOCX (mammoth), XLSX/XLS (SheetJS), CSV, TXT.

### API push (multipart file)
```bash
curl -X POST https://<host>/api/extract \
  -H "Authorization: Bearer trk_xxx" \
  -F "file=@/path/to/invoice.pdf"
```

### API push (by URL)
```bash
curl -X POST https://<host>/api/extract \
  -H "Authorization: Bearer trk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"fileUrl":"https://files.example/inv-42.pdf","mediaType":"application/pdf","filename":"inv-42.pdf"}'
```

Response:
```json
{
  "documentId": "uuid",
  "status": "extracted",            // or "needs_review"
  "extractedFields": { "vendor": "Acme", "total": "$1,000.00" },
  "confidenceScores": { "vendor": 0.98, "total": 0.91 },
  "minConfidence": 0.91,
  "delivered": true
}
```

### Manual upload
The dashboard's agent page has a "Process a document" upload (Clerk-authed, no
API key) — useful for ad-hoc runs and demos.

### Email-in (stub)
Each agent shows a `doc-<token>@<inbound-domain>` address. Inbound delivery
(routing forwarded mail to `/api/extract`) is not yet enabled.

### MCP (AI-native customers)
Point an MCP client at the streamable endpoint, authenticated by the agent key:
```json
{
  "mcpServers": {
    "trestle": {
      "url": "https://<host>/api/mcp/mcp",
      "headers": { "Authorization": "Bearer trk_xxx" }
    }
  }
}
```
Exposes one tool, `extract_document({ fileUrl, mediaType?, filename? })`.

---

## Outputs

### Signed webhook (default)
Set a webhook URL + secret on the agent. High-confidence results POST as:
```json
{ "agentId": "...", "documentId": "...", "extractedFields": {...},
  "confidenceScores": {...}, "minConfidence": 0.91 }
```
Verify the signature (`X-Trestle-Signature`, HMAC-SHA256 over the raw body):
```ts
import { createHmac, timingSafeEqual } from "node:crypto";

function verify(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```
Delivery retries on 5xx/429/network (3 attempts, exponential backoff) and every
attempt is logged (visible on the agent page).

### Custom destination (push into the customer's app)
When the customer needs their own payload shape / endpoint / auth, register a
destination adapter — it takes precedence over the webhook.

```ts
// lib/customers/acme-invoices.ts
import { registerDestination, httpDestination } from "@/lib/adapters/registry";

registerDestination("<agent-id>", httpDestination({
  url: "https://acme.example/api/intake",
  headers: { Authorization: `Bearer ${process.env.ACME_TOKEN}` },
  transform: (ctx) => ({
    form: ctx.extractedFields,
    confidence: ctx.minConfidence,
    source: "trestle",
  }),
}));
```

### Review queue
Low-confidence results appear on the agent page; resolving one writes a
correction sample (`source='correction'`) that feeds the next training run.

---

## Custom tools (per-agent agentic behaviour)

The agent runs a tool loop before answering. Register customer-specific
validation/lookup tools — they're merged with the built-ins (`calculate`,
`validate_date`) in **both production and training**, so accuracy is measured
under production conditions.

```ts
// lib/customers/acme-invoices.ts
import { tool } from "ai";
import { z } from "zod";
import { registerAgentTools } from "@/lib/agent/tools/registry";

registerAgentTools("<agent-id>", {
  lookup_po: tool({
    description: "Check a purchase-order number exists in the customer's ERP.",
    inputSchema: z.object({ po: z.string() }),
    execute: async ({ po }) => ({ exists: await erp.hasPO(po) }),
  }),
});
```

## Wiring it up

Import each customer module from `lib/customers/index.ts` so its registrations
run before extraction:
```ts
// lib/customers/index.ts
import "./acme-invoices";
export {};
```
