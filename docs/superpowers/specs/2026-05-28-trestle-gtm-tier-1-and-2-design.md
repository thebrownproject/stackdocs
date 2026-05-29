# Trestle GTM Tier 1 + Tier 2 Design

**Date:** 2026-05-28
**Status:** Draft for implementation
**Audience:** Implementer (codex). Self-contained; no Trestle prior knowledge required beyond `docs/specs/TRESTLE-ARCHITECTURE.md`.

## 1. Context

Trestle's extraction engine and training harness work end to end. The 4-week goal is to enable a part-time founder to run codex's "free accuracy audit" GTM motion: send a polished accuracy report to cold prospects, convert engaged prospects to self-serve pilots at $300-$1500/month, ship paid extractions to standard destinations (no engineering per customer), and meter usage with Stripe.

This spec covers six pieces. Build in the order listed; later pieces depend on earlier ones.

## 2. Goals

- Enable Fraser to send a shareable, prospect-facing audit report from any completed eval run.
- Enable an inbound prospect to send sample docs without creating an account (via external form).
- Make the demo-mode flag impossible to enable in production.
- Make self-serve sample upload + training usable by a non-engineer (current UX is one-at-a-time JSON paste).
- Let customers configure destinations through the dashboard (today destinations are code-only).
- Bill subscriptions via Stripe with usage caps enforced in the extraction path.

## 3. Non-goals

These are explicitly out of scope. Resist building them.

- SOC2, SSO, SAML, DPA infrastructure (irrelevant at this revenue tier).
- Async/queued training (the current 60-sample sync cap is fine for audits and small pilots).
- Outbox-pattern delivery retries (current 3-attempt in-band retry is acceptable; revisit if a customer complains).
- Retraining triggers on corrections (manual retraining is fine for first 3-5 customers).
- Marketing website / SEO landing pages.
- Per-vertical destinations (Xero, MYOB, CargoWise, etc.). Generic destinations only for v1.
- Inbound email-in (the stub stays a stub; intake is via dashboard upload or Tally form).
- OAuth flows for destination services (use simpler auth patterns; see §9).

## 4. Decisions locked

| Decision | Choice | Why |
|---|---|---|
| Audit format | Shareable web page at public, token-gated URL | Lower build cost than PDF; live updates; interactive review-rate slider |
| Intake mechanism | External form (Tally) emailing Fraser | Zero new code; ships today; defers in-app intake until demand proven |
| Vertical | Agnostic for v1 | User chose to stay horizontal; destinations are generic, not per-vertical |
| Destinations | Three: Google Sheets, Email, Enhanced Webhook | Cover 90% of customer needs without OAuth complexity |
| Billing model | Subscription + per-doc overage | Matches codex's $500-$2k setup + $300-$1500/mo guidance |
| Google Sheets auth | Service account, customer shares sheet with it | Avoids OAuth flow; one-time setup per customer |

## 5. Architecture additions

### 5.1 New tables (one migration: `016_gtm_tier1_tier2.sql`)

```sql
-- Public, token-gated audit report links. Each links one prospect view to one
-- eval_run. Revocation = set revoked_at; expiry = set expires_at.
CREATE TABLE audit_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    eval_run_id UUID NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',
    prospect_name TEXT,
    prospect_company TEXT,
    prospect_email TEXT,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    view_count INTEGER NOT NULL DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_links_token ON audit_links(token);
CREATE INDEX idx_audit_links_user ON audit_links(user_id);
ALTER TABLE audit_links ENABLE ROW LEVEL SECURITY;
-- Owner can manage their links; the audit page reads via the service-role
-- client (token IS the auth), so no public-read policy needed.
CREATE POLICY audit_links_owner ON audit_links
  FOR ALL USING (user_id = auth.jwt()->>'sub');

-- User-configurable destinations. Replaces the in-memory adapter registry as
-- the primary lookup in process.ts; the code registry stays as escape hatch.
CREATE TABLE destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',
    kind TEXT NOT NULL CHECK (kind IN ('webhook', 'google_sheets', 'email')),
    label TEXT,
    config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_destinations_agent ON destinations(agent_id);
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY destinations_owner ON destinations
  FOR ALL USING (user_id = auth.jwt()->>'sub');

-- Billing state lives on a per-user row keyed by Clerk subject id (the same
-- TEXT user_id pattern used by every other Trestle table; no separate users
-- table exists). Row is created lazily on first checkQuota call for a user.
CREATE TABLE user_billing (
    user_id TEXT PRIMARY KEY,
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT UNIQUE,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro')),
    plan_status TEXT NOT NULL DEFAULT 'active'
        CHECK (plan_status IN ('active', 'past_due', 'canceled', 'trialing')),
    docs_processed_current_period INTEGER NOT NULL DEFAULT 0,
    period_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    period_ends_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE user_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_billing_owner ON user_billing
  FOR ALL USING (user_id = auth.jwt()->>'sub');
```

### 5.2 New library files

```
frontend/lib/
├── demo-mode.ts                # Centralised flag + production assertion
├── audit/
│   ├── tokens.ts               # Token generation + lookup helpers
│   ├── verdict.ts              # Plain-English verdict from accuracy stats
│   └── review-rate.ts          # Review-rate-at-threshold computation
├── adapters/
│   ├── google-sheets.ts        # New: Google Sheets API delivery
│   ├── email.ts                # New: Resend-based templated email delivery
│   └── (webhook.ts modified for template support)
├── destinations/
│   ├── resolver.ts             # Loads + invokes DB-stored destinations
│   └── validators.ts           # Zod schemas for each destination's config
├── billing/
│   ├── stripe.ts               # Stripe client + plan definitions
│   ├── enforce.ts              # Plan check used by process.ts
│   └── usage.ts                # Counter increment + period reset
└── queries/
    └── audit.ts                # getAuditByToken, listAuditLinks
```

### 5.3 New routes

```
frontend/app/
├── audit/[token]/page.tsx                     # Public audit report
└── api/
    ├── audit-links/route.ts                   # POST: create link (Clerk)
    ├── audit-links/[id]/route.ts              # DELETE: revoke (Clerk)
    ├── destinations/route.ts                  # GET, POST (Clerk)
    ├── destinations/[id]/route.ts             # PATCH, DELETE (Clerk)
    └── webhooks/stripe/route.ts               # POST: Stripe events
    └── billing/
        ├── checkout/route.ts                  # POST: create Checkout session
        └── portal/route.ts                    # POST: create Portal session
```

### 5.4 Existing files modified

```
frontend/proxy.ts                         # Call assertDemoModeSafe()
frontend/lib/supabase-server.ts           # Call assertDemoModeSafe()
frontend/lib/agent/process.ts             # Use destinations resolver; call billing enforce
frontend/components/agents/sample-upload.tsx  # Replaced (multi-file + CSV)
frontend/components/agents/train-button.tsx   # On complete, generate audit link + show URL
frontend/app/(app)/agents/[id]/page.tsx   # Add Destinations + Audit Links sections
```

## 6. Piece 1: Demo-mode guard

**Purpose:** Make it impossible to deploy with `NEXT_PUBLIC_DEMO_MODE=true` in production. Today, that combination silently disables Clerk auth and escalates every server query to service-role.

### File: `frontend/lib/demo-mode.ts` (new)

```typescript
export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

/**
 * Throws at module load if demo mode is on in production. Must be called from
 * any module that grants demo-mode escalations (auth bypass, service-role
 * access). Safe to call multiple times.
 */
export function assertDemoModeSafe(): void {
  if (isDemoMode && process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_DEMO_MODE=true is not permitted when NODE_ENV=production. " +
      "This flag disables Clerk auth and uses the service-role key for all " +
      "server queries; enabling it in production would expose every account.",
    );
  }
}
```

### Modifications

- `frontend/proxy.ts:1`: import and call `assertDemoModeSafe()` at module top level (before `const isDemoMode = ...`). Replace the local `isDemoMode` constant with the imported one.
- `frontend/lib/supabase-server.ts:6`: same. Replace local constant with import. Call `assertDemoModeSafe()` at module top level.

### Tests

- `frontend/lib/__tests__/demo-mode.test.ts`: assert throws when both flags set; assert no-op otherwise. Mock `process.env`.

### Acceptance

- Setting `NEXT_PUBLIC_DEMO_MODE=true` + `NODE_ENV=production` causes the app to fail to boot with a clear error.
- Setting `NEXT_PUBLIC_DEMO_MODE=true` + `NODE_ENV=development` works as today.

## 7. Piece 2: Prospect intake (no code)

**Purpose:** Receive sample docs from cold prospects without account signup.

### Setup (Fraser does this, not codex)

1. Create a Tally form at `tally.so` with fields:
   - Name (text, required)
   - Company (text, required)
   - Work email (email, required)
   - Document type description (long text, required) e.g. "AP invoices from suppliers"
   - Sample documents (file upload, multi, 10-30 files, accept: pdf, png, jpg, jpeg, webp, docx, xlsx, csv)
   - Expected outputs CSV (file upload, single, accept: csv) with attached template
   - Anything else we should know? (long text, optional)
2. Wire form submissions to email Fraser with attachments.
3. Host the CSV template on the marketing site or in a Google Drive folder. Template:
   ```
   filename,field_1,field_2,field_3
   invoice-001.pdf,Acme Corp,1250.50,2026-04-15
   invoice-002.pdf,Globex,99.99,2026-04-20
   ```

### Fraser's manual workflow (documented in `docs/runbooks/audit-workflow.md`)

1. Tally email arrives.
2. Create an internal "prospect" agent in the dashboard.
3. Use the new multi-upload UI (Piece 4) to drop all sample files + the CSV.
4. Kick off training.
5. On complete, generate an audit link (Piece 3) and email it to the prospect.

### Acceptance

- A new file `docs/runbooks/audit-workflow.md` exists describing the above flow.
- The Tally form and CSV template are referenced in the runbook (URLs left as TODO for Fraser to fill).

## 8. Piece 3: Audit report page (the Tier 1 deliverable)

**Purpose:** A polished, shareable web page that takes a completed eval_run and renders a prospect-facing accuracy report. This is the artifact Fraser sends to cold prospects.

### 8.1 Token generation and link creation

#### File: `frontend/lib/audit/tokens.ts` (new)

```typescript
import { randomBytes } from "node:crypto";

export function generateAuditToken(): string {
  // 24 bytes = 32 chars base64url. Long enough to be unguessable.
  return randomBytes(24).toString("base64url");
}
```

#### Route: `POST /api/audit-links/route.ts`

Request body (Zod):
```typescript
{
  evalRunId: string;       // UUID
  prospectName?: string;
  prospectCompany?: string;
  prospectEmail?: string;
  expiresInDays?: number;  // default 30
}
```

Response: `{ token, url, expiresAt }`. URL is `${origin}/audit/${token}`.

Auth: Clerk-protected. Verifies the user owns the eval_run (via agent.user_id) before creating the link.

#### Route: `DELETE /api/audit-links/[id]/route.ts`

Sets `revoked_at = now()`. Clerk-protected. Verifies ownership.

### 8.2 Public audit page

#### Route: `app/audit/[token]/page.tsx` (new)

```typescript
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // needs node:crypto in adapters chain

export default async function AuditPage({
  params,
}: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const audit = await getAuditByToken(token);
  if (!audit) notFound();
  if (audit.revoked_at) return <RevokedNotice />;
  if (audit.expires_at && new Date(audit.expires_at) < new Date()) {
    return <ExpiredNotice />;
  }
  // Increment view counter (fire-and-forget; don't block render).
  recordAuditView(audit.id).catch(() => {});
  return <AuditReport audit={audit} />;
}
```

#### Data loader: `lib/queries/audit.ts`

```typescript
export interface AuditData {
  link: AuditLinkRow;
  agent: { name: string; created_at: string };
  eval_run: { overall_accuracy: number; per_field_scores: PerFieldScores;
              sample_count: number; bundle_version: number | null; completed_at: string };
  field_schema: FieldSchema;           // From the bundle if bundle_version set, else from eval_run
  bundle: AgentBundleRow | null;
  samples: Array<{                      // Up to N samples; see §8.3
    id: string;
    filename: string;
    expected_output: Record<string, unknown>;
    predicted_output: Record<string, unknown>;
    per_field_passed: Record<string, boolean>;
    confidence_scores: Record<string, unknown>;
  }>;
}

export async function getAuditByToken(token: string): Promise<AuditData | null>;
export async function recordAuditView(id: string): Promise<void>;
```

Loader uses `createAdminSupabaseClient()` (service-role) because the page is public. The token IS the authorisation; no Clerk JWT required.

### 8.3 Components

All server components except the slider. Located under `frontend/components/audit/`.

| Component | Purpose | Key props |
|---|---|---|
| `AuditReport.tsx` | Top-level layout, composes the others | `audit: AuditData` |
| `AuditHeader.tsx` | "Trestle accuracy audit for {company}", date, prospect name | `audit` |
| `HeadlineNumber.tsx` | Large overall accuracy %, sample count, doc type | `audit.eval_run`, `audit.agent` |
| `PerFieldTable.tsx` | Field name, scorer type, accuracy, count, mini bar | `audit.eval_run.per_field_scores`, `audit.field_schema` |
| `SampleComparison.tsx` | One sample's expected vs extracted, side by side, diff-coloured | one sample row |
| `SampleComparisonList.tsx` | Picks 3-5 representative samples (see §8.4) | `audit.samples` |
| `FailedCasesTable.tsx` | All failed (sample, field, expected, actual) rows, sortable client | `audit.samples`, `audit.field_schema` |
| `ReviewRateSlider.tsx` | Client component: slider for confidence threshold, computes split | `audit.samples`, `audit.bundle.calibration_map` |
| `Verdict.tsx` | Plain-English verdict (see §8.5) | `audit.eval_run`, `audit.samples` |
| `AuditFooter.tsx` | CTA: "Want a paid pilot? Reply to the email." | `audit.link.prospect_email` |

### 8.4 Sample selection logic for SampleComparisonList

Show up to 5 samples chosen to be informative:
1. The best-performing sample (highest per-field pass rate).
2. The worst-performing sample (lowest per-field pass rate).
3. Up to 3 samples that contain the most-failed field, sorted by sample id for determinism.

If fewer than 5 samples total, show all.

### 8.5 Verdict logic: `lib/audit/verdict.ts`

```typescript
export interface VerdictInput {
  overallAccuracy: number;
  perFieldAccuracy: number[];    // values, for variance
  estimatedReviewRate: number;   // computed at threshold 0.7
}

export interface Verdict {
  rating: "production_ready" | "strong" | "promising" | "not_ready";
  headline: string;
  detail: string;
}

export function verdict(input: VerdictInput): Verdict;
```

Rules:
- `overall >= 0.95`: "production_ready" / "Production-ready" / "Trestle would auto-process {100 - reviewRate}% of your docs with no human review."
- `overall >= 0.85`: "strong" / "Strong" / "With light correction, this is suitable for production. Roughly {reviewRate}% would route to human review."
- `overall >= 0.70`: "promising" / "Promising, needs more data" / "Currently {reviewRate}% would need review. More diverse training samples typically lifts accuracy 5-15 points."
- else: "not_ready" / "Not ready" / "Accuracy too low for production. Often this indicates ambiguous field definitions or insufficient sample diversity."

### 8.6 Review-rate-at-threshold: `lib/audit/review-rate.ts`

```typescript
import { applyCalibration, type CalibrationMap } from "../harness/calibration";
import { minConfidence as minConf } from "../agent/schema-to-zod";

/**
 * For each sample, compute the calibrated min-confidence. Returns the fraction
 * of samples that would route to the review queue (calibrated min < threshold).
 */
export function reviewRateAtThreshold(
  samples: Array<{ confidence_scores: Record<string, unknown> }>,
  calibrationMap: CalibrationMap | null,
  threshold: number,
): number;
```

The slider component (`ReviewRateSlider.tsx`) is a `"use client"` component that runs this in the browser as the user drags. Memoise per-sample calibrated min upfront.

### 8.7 Visual treatment

Use existing shadcn/ui primitives. Visual reference:

```
[Trestle logo]                                    May 28, 2026

Accuracy audit for Acme Accounting
Prepared for: Jane Smith (jane@acmeaccounting.com)

┌─────────────────────────────────────────────────┐
│                                                 │
│              91.2% accurate                     │
│         on 24 of your AP invoices               │
│                                                 │
└─────────────────────────────────────────────────┘

Per-field accuracy
┌──────────────────┬─────────┬──────────┬───────┐
│ Field            │ Scorer  │ Accuracy │ Count │
├──────────────────┼─────────┼──────────┼───────┤
│ vendor_name      │ fuzzy   │ 96%      │ 24/24 │
│ invoice_number   │ exact   │ 100%     │ 24/24 │
│ total            │ numeric │ 92%      │ 22/24 │
│ issued_date      │ date    │ 88%      │ 21/24 │
│ due_date         │ date    │ 79%      │ 19/24 │
└──────────────────┴─────────┴──────────┴───────┘

[Review-rate slider: threshold 0.7 → 87% auto, 13% review]

Sample comparisons (3 of 24)
[expected | extracted side by side, mismatches highlighted]

Failed cases (8)
[expandable table]

Verdict
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Strong. With light correction, suitable for production.
Roughly 13% would route to human review.

[Want a paid pilot? Reply to my email.]
```

Use the `frontend-design` skill if visual polish needs work. Keep the page narrow (max 960px), serif heading, monospace numbers.

### Acceptance

- Visiting `/audit/<valid-token>` renders the full report.
- Visiting `/audit/<revoked-token>` shows a "this link has been revoked" notice.
- Visiting `/audit/<expired-token>` shows an "expired" notice.
- Visiting `/audit/<unknown-token>` returns 404.
- Each visit increments `view_count` and updates `last_viewed_at`.
- A Clerk-authed user can `POST /api/audit-links` for an eval_run they own, and `DELETE /api/audit-links/:id` to revoke.
- A Clerk-authed user CANNOT create a link for an eval_run they don't own (returns 403).
- The review-rate slider updates in real time as the user drags.

## 9. Piece 4: Self-serve upload + training polish

**Purpose:** Today (`components/agents/sample-upload.tsx`) accepts one file at a time and requires the user to type/paste a JSON object for ground truth. Unusable for an accountant with 30 invoices.

### 9.1 New component: `components/agents/bulk-sample-upload.tsx`

Replaces `sample-upload.tsx`. Behaviour:

1. **Drop zone:** accepts multiple files at once (PDF, PNG, JPG, WEBP, DOCX, XLSX, CSV, TXT).
2. **Expected outputs:** accepts a CSV file OR a JSON file containing an array of objects keyed by filename. Auto-detects by extension.
3. **Pairing:** matches each uploaded document to its row in the expected-outputs file by `filename` column (CSV) or object key (JSON).
4. **Preview:** before submit, show a table: filename, matched? (✓/✗), expected output (collapsed JSON). Files without a matching row are flagged; rows without a matching file are flagged.
5. **Submit:** POSTs all matched (file, expected) pairs to a new bulk endpoint.

CSV parsing: use `papaparse` (already in npm ecosystem; add to deps).
JSON shape:
```json
{
  "invoice-001.pdf": { "vendor": "Acme", "total": 1250.50 },
  "invoice-002.pdf": { "vendor": "Globex", "total": 99.99 }
}
```

### 9.2 Bulk samples endpoint: `POST /api/agents/[id]/samples/bulk`

Request: multipart form-data with N files and one `expected` JSON field containing `Array<{ filename: string; expected_output: object }>`.

Behaviour: for each file, upload to Supabase Storage at `samples/{agent_id}/{uuid}.{ext}`, insert a `samples` row. All-or-nothing transaction (if any insert fails, delete uploaded blobs and roll back).

Response: `{ inserted: number, failed: Array<{ filename, error }> }`.

The existing single-sample route stays for backward compatibility.

### 9.3 Train button enhancement

`components/agents/train-button.tsx` on completion:

1. Already logs "Promoted bundle vX — Y% held-out".
2. NEW: automatically call `POST /api/audit-links` for the just-completed `eval_run_id` (the SSE stream's `held_out` event contains `version`; the next event with `complete: true` contains the run id - extend the orchestrator to emit `eval_run_id` in the held_out event).
3. NEW: show the audit URL prominently with a "Copy link" button.

Orchestrator change (`lib/harness/orchestrator.ts:235`): the `held_out` yield must include `eval_run_id`. Currently it does not.

### 9.4 Empty states + onboarding hints

- Agent detail page: when no samples uploaded, show a 3-step inline guide:
  1. "Upload 10-30 sample documents"
  2. "Upload the expected outputs (CSV template)"
  3. "Click Train and watch the accuracy number"
- Link to the CSV template download.

### Acceptance

- A user can drop 20 PDFs and a CSV in one go, see the matching table, and submit.
- Mismatched filenames are flagged before submit, not after.
- After training completes, the audit URL is shown and copyable.
- Empty-state guide appears when an agent has zero samples.

## 10. Piece 5: User-configurable destinations

**Purpose:** Today `process.ts` calls `getDestination(agent.id)` from an in-memory registry that requires a TS file per customer. For self-serve customers, destinations must be DB-stored and configured through the dashboard.

### 10.1 Resolver: `lib/destinations/resolver.ts`

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeliveryContext, DestinationAdapter } from "../adapters/registry";

/**
 * Fetches enabled destinations for an agent and returns adapter instances ready
 * to deliver. The code-level registry from adapters/registry.ts takes
 * precedence (escape hatch for custom-customer adapters).
 */
export async function resolveDestinations(
  db: SupabaseClient,
  agentId: string,
): Promise<DestinationAdapter[]>;

/**
 * Deliver to all destinations in parallel. Returns one DeliveryResult per
 * destination, in the same order as the input adapters.
 */
export async function deliverAll(
  adapters: DestinationAdapter[],
  ctx: DeliveryContext,
): Promise<Array<DeliveryResult & { label: string }>>;
```

### 10.2 Config schemas: `lib/destinations/validators.ts`

```typescript
import { z } from "zod";

export const webhookConfig = z.object({
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
  payload_template: z.string().optional(), // Handlebars-style {{path.to.field}}
  secret: z.string().optional(),            // HMAC secret
});

export const googleSheetsConfig = z.object({
  spreadsheet_id: z.string().min(10),
  sheet_name: z.string().min(1),
  // dot-path → column letter (e.g. { "vendor.name": "A", "total": "B" })
  column_mapping: z.record(z.string(), z.string().regex(/^[A-Z]+$/)),
});

export const emailConfig = z.object({
  to: z.string().email(),
  cc: z.array(z.string().email()).optional(),
  subject_template: z.string().min(1),
  body_template: z.string().min(1),
});

export const destinationConfig = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("webhook"), config: webhookConfig }),
  z.object({ kind: z.literal("google_sheets"), config: googleSheetsConfig }),
  z.object({ kind: z.literal("email"), config: emailConfig }),
]);
```

### 10.3 New adapter: `lib/adapters/google-sheets.ts`

```typescript
import { google } from "googleapis";  // add to deps
import type { DestinationAdapter, DeliveryContext } from "./registry";

export function googleSheetsDestination(config: {
  spreadsheet_id: string;
  sheet_name: string;
  column_mapping: Record<string, string>;
}): DestinationAdapter;
```

Auth: service account using `GOOGLE_SERVICE_ACCOUNT_KEY` env var (base64-encoded JSON). The user shares their sheet with `trestle-deliveries@<project>.iam.gserviceaccount.com` and the adapter appends a row.

Failure modes:
- Sheet not shared with service account → return `{ ok: false, status: 403, error: "Sheet not shared with..." }`.
- Sheet not found → 404.
- Spreadsheet API rate-limited → retry handled by `postWithRetry`-equivalent.

### 10.4 New adapter: `lib/adapters/email.ts`

```typescript
import { Resend } from "resend";  // add to deps
import Handlebars from "handlebars";  // add to deps
import type { DestinationAdapter, DeliveryContext } from "./registry";

export function emailDestination(config: {
  to: string;
  cc?: string[];
  subject_template: string;
  body_template: string;
}): DestinationAdapter;
```

Templates are rendered with Handlebars against `{ fields: extractedFields, confidence: confidenceScores, minConfidence, documentId, agentId }`.

Env: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (e.g. `Trestle <deliveries@trestle.dev>`).

### 10.5 Webhook enhancement

`lib/adapters/webhook.ts`: if `payload_template` is set, render via Handlebars and use that body instead of the default JSON. Otherwise current behaviour. Add a `lib/adapters/template.ts` shared renderer.

### 10.6 process.ts integration

Replace `getDestination(agent.id)` block at `frontend/lib/agent/process.ts:123` with:

```typescript
const adapters = await resolveDestinations(db, agent.id);
// Append the legacy webhook_url as a destination if no DB destinations exist
// and a webhook URL is configured (backward compatibility for agents created
// before the destinations table existed).
if (adapters.length === 0 && agent.webhook_url) {
  adapters.push({
    label: agent.webhook_url,
    deliver: (c) => deliverWebhook(agent.webhook_url!, agent.webhook_secret, c),
  });
}
if (adapters.length > 0) {
  const results = await deliverAll(adapters, ctx);
  delivered = results.every((r) => r.ok);
  for (const r of results) {
    await db.from("webhook_deliveries").insert({
      agent_id: agent.id, document_id: documentId, user_id: agent.user_id,
      url: r.label, ok: r.ok, status_code: r.status || null,
      attempts: r.attempts, error: r.error ?? null,
    });
  }
}
```

### 10.7 Routes

`GET /api/destinations?agent_id=X`: list (Clerk).
`POST /api/destinations`: create. Body: `{ agentId, kind, label?, config }`. Validates via `destinationConfig`.
`PATCH /api/destinations/[id]`: update. Body: same shape as POST minus agentId.
`DELETE /api/destinations/[id]`: delete (or set enabled=false).

### 10.8 Dashboard UI

New page: `app/(app)/agents/[id]/destinations/page.tsx`. Lists existing destinations as cards, "Add destination" button opens a sheet (shadcn) with kind picker, then a config form. Each kind gets its own form:

- **Webhook:** url, secret, headers (key-value), test button.
- **Google Sheets:** spreadsheet_id (with helper text: "Share the sheet with `<service-account-email>` as Editor"), sheet_name, column_mapping (dynamic key-value mapping field-path → column).
- **Email:** to, cc, subject_template, body_template (textarea with hint listing available variables).

Test button: posts a synthetic `DeliveryContext` to the destination and shows the result inline. Lets a customer verify their config without waiting for a real extraction.

### Acceptance

- A user can add a Google Sheets destination, click Test, and see a row appear in their sheet.
- A user can add an Email destination, click Test, and receive a templated email.
- A user can add multiple destinations; all fire in parallel when a doc is extracted.
- The legacy `agents.webhook_url` still works as a fallback for agents with no DB destinations.

## 11. Piece 6: Stripe billing

**Purpose:** Subscriptions, plan enforcement, usage metering.

### 11.1 Plans

Defined in `lib/billing/stripe.ts`:

```typescript
export type Plan = "free" | "starter" | "pro";

export const PLANS: Record<Plan, {
  name: string;
  monthlyPriceUsd: number;        // marketing-displayed price
  docsIncluded: number;
  perDocOverageUsd: number;
  stripePriceId: string | null;   // null for free
}> = {
  free:    { name: "Free",    monthlyPriceUsd: 0,    docsIncluded: 25,   perDocOverageUsd: 0,    stripePriceId: null },
  starter: { name: "Starter", monthlyPriceUsd: 500,  docsIncluded: 1000, perDocOverageUsd: 0.30, stripePriceId: process.env.STRIPE_PRICE_STARTER! },
  pro:     { name: "Pro",     monthlyPriceUsd: 1500, docsIncluded: 5000, perDocOverageUsd: 0.20, stripePriceId: process.env.STRIPE_PRICE_PRO! },
};
```

Free plan: hard cap, no overage. Past 25 docs/month, extractions return 402 Payment Required with a message linking to the upgrade page.

Starter/Pro: soft cap. Past included quota, each doc bills $X via Stripe usage-based billing. Use Stripe Meters (recommended over deprecated usage records). Configure two meters in Stripe: `trestle_doc_processed_starter` and `trestle_doc_processed_pro`.

### 11.2 Stripe client: `lib/billing/stripe.ts`

```typescript
import Stripe from "stripe";  // add to deps
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",  // pin
});

export async function ensureStripeCustomer(userId: string, email: string): Promise<string>;
```

### 11.3 Enforcement: `lib/billing/enforce.ts`

```typescript
export interface QuotaCheck {
  allowed: boolean;
  reason?: "free_cap_exceeded" | "subscription_inactive";
  upgradeUrl?: string;
}

/** Called from process.ts BEFORE running the agent. */
export async function checkQuota(db: SupabaseClient, userId: string): Promise<QuotaCheck>;

/** Called from process.ts AFTER a successful extraction. */
export async function recordUsage(db: SupabaseClient, userId: string): Promise<void>;
```

`checkQuota` reads `user_billing` row, returns:
- `plan_status !== 'active' && plan !== 'free'` → `{ allowed: false, reason: "subscription_inactive" }`
- `plan === 'free' && docs_processed_current_period >= 25` → `{ allowed: false, reason: "free_cap_exceeded" }`
- otherwise → `{ allowed: true }`

`recordUsage` increments `docs_processed_current_period`. For starter/pro plans on overage, also reports usage to the Stripe meter via `stripe.billing.meterEvents.create()`.

### 11.4 process.ts integration

At the top of `processDocument()`:

```typescript
const quota = await checkQuota(db, agent.user_id);
if (!quota.allowed) {
  throw new QuotaExceededError(quota.reason!, quota.upgradeUrl);
}
```

After successful extraction (before returning result), call `recordUsage`.

API routes that call `processDocument()` (`/api/extract`, `/api/agents/[id]/process`) catch `QuotaExceededError` and return 402 with body `{ error: "...", upgradeUrl: "..." }`.

### 11.5 Period reset

Two options:
- **Lazy:** on each `checkQuota`, if `period_ends_at` is null or `period_ends_at < now()`, reset counter and roll period to `[now(), now() + 30 days)`. Simple, no cron.
- **Cron:** Vercel Cron daily at 00:00 UTC. More predictable but adds infra.

Pick lazy for v1. Document the choice in comments. Note: free-plan users have `period_ends_at = NULL` on signup; the first `checkQuota` call initialises it. Paid plans set `period_ends_at` from the Stripe subscription's `current_period_end` via webhook.

### 11.6 Routes

`POST /api/billing/checkout`: body `{ plan: "starter" | "pro" }`. Creates Checkout session, returns `{ url }`. Sets `success_url` to `/settings/billing?success=1`, `cancel_url` to `/settings/billing`.

`POST /api/billing/portal`: creates Customer Portal session, returns `{ url }`.

`POST /api/webhooks/stripe`: verifies signature (`STRIPE_WEBHOOK_SECRET`), handles:
- `checkout.session.completed`: set plan + status + period dates on `user_billing`.
- `customer.subscription.updated`: update status + period.
- `customer.subscription.deleted`: set status to canceled.
- `invoice.payment_failed`: set status to past_due.

### 11.7 UI

New page: `app/(app)/settings/billing/page.tsx`:
- Current plan + status badge.
- Usage this period (docs used / docs included).
- If free: 3 plan cards with "Upgrade" buttons → POSTs to checkout.
- If paid: "Manage subscription" button → POSTs to portal.

### Acceptance

- A free user processing their 26th doc this period gets 402.
- A starter user can upgrade through Checkout and immediately process docs.
- A starter user processing their 1001st doc this period still succeeds; usage is reported to the Stripe meter.
- A subscription cancelled in Stripe Customer Portal reflects in `user_billing.plan_status` within seconds via webhook.
- Period rolls over correctly on the lazy path.

## 12. Build order and milestones

| Order | Piece | Milestone |
|---|---|---|
| 1 | Demo-mode guard | App fails to boot in production with the flag on |
| 2 | Prospect intake | Runbook documented; Tally form live (Fraser) |
| 3 | Audit report page | Fraser can generate a link from any eval_run and send it |
| 4 | Self-serve upload polish | A non-engineer can upload 20 files + CSV in one go |
| 5 | User-configurable destinations | A customer can add a Google Sheet through the dashboard |
| 6 | Stripe billing | A free user hits the cap and converts via Checkout |

Pieces 1-3 unblock the first prospect conversation. Pieces 4-6 unblock self-serve paid pilots.

## 13. Testing strategy

### 13.1 Unit tests (vitest)

- `lib/__tests__/demo-mode.test.ts`: assertion behaviour.
- `lib/audit/__tests__/verdict.test.ts`: each rating tier.
- `lib/audit/__tests__/review-rate.test.ts`: threshold sweep correctness.
- `lib/destinations/__tests__/validators.test.ts`: each kind's config rejects/accepts as expected.
- `lib/destinations/__tests__/resolver.test.ts`: mocked DB returns correct adapters.
- `lib/adapters/__tests__/google-sheets.test.ts`: mocked googleapis client.
- `lib/adapters/__tests__/email.test.ts`: mocked Resend, template rendering.
- `lib/billing/__tests__/enforce.test.ts`: each quota branch.

### 13.2 Integration tests

- Audit page renders for a real eval_run fixture (use a snapshot of the existing test data).
- Bulk samples endpoint: upload 3 files + JSON, assert 3 sample rows + 3 storage blobs.
- Destinations CRUD: create, list, update, delete via API routes.
- Stripe webhook: feed signed test events, assert `user_billing` state transitions.

### 13.3 Manual verification

- Run `npm run verify` (the existing headless pipeline) and confirm it still passes.
- Generate an audit link for the verify output and visually check the page renders.
- Add a Google Sheet destination with a personal sheet, send a test, see the row appear.

## 14. Open questions

These need answers before or during implementation. Not blockers for spec approval.

1. **Audit page domain:** does Fraser want `/audit/[token]` on the main app domain, or on a separate marketing-friendly domain (e.g. `audit.trestle.dev`)? Affects link aesthetics.
2. **Email "from" address:** Resend needs a verified domain. Does Fraser have `trestle.dev` DNS access?
3. **Stripe prices:** Fraser must create the Starter and Pro prices in Stripe and set `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PRO` env vars. Document this in the runbook.
4. **Google service account:** Fraser must create a GCP project, create a service account with Sheets API scope, download the JSON key, base64-encode it, set `GOOGLE_SERVICE_ACCOUNT_KEY`. Document.
5. **Failed cases drilldown:** should we include the document file (signed Supabase URL) inline in the audit page, or just the structured comparison? v1 = structured only.
6. **Plan-change UX:** what happens if a starter user downgrades to free mid-period and is already over the free cap? v1 = block new extractions until period rolls; document explicitly.

## 15. What this spec does not cover

Anything in the §3 non-goals list. If the implementer feels something there is required, raise it and update this spec rather than adding scope silently.
