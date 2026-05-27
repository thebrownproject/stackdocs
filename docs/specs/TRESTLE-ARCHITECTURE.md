# Trestle — Architecture

**Status:** Draft v0.1
**Supersedes:** the per-agent Fly/container and Sprite/Bridge isolation plans.
**One-line:** One shared agent, parameterised per account by a tuned config bundle, with an eval harness that produces those bundles and a measured accuracy number before the customer pays.

---

## 1. Decisions locked in this design

| Decision | Choice | Why |
|---|---|---|
| Isolation model | **Shared agent runtime + per-account config** ("same agent, different rules") | Maintainability. No deployment per customer. |
| Tenancy | **Logical** (per-account config + row-level data scoping) | Simpler than physical isolation. See trade below. |
| Agent runtime | **Vercel AI SDK v6** (`Agent` + `streamText` + `Output.object`) | One shared agent, structured output, model call stays direct (our key). |
| Document reading | **Direct multimodal** — no OCR | Drop Mistral + `ocr_results` + caching. Models read PDFs/images natively. |
| Hosting | **All Vercel services** | Frontend already here; consolidates the stack. |
| Auth | **Clerk** | Already configured. |
| Eval harness | **Custom TS**, deterministic scorers | The IP. Reproducible scoring = "trust before you pay". |

**The trade we accepted:** logical isolation gives up the "your own isolated runtime / BYOK" enterprise story. AU data residency is preserved via Vercel + Postgres region selection and row-level scoping. Chosen deliberately in favour of a single maintainable stack.

---

## 2. Stack

- **Frontend + API + agent runtime + harness jobs:** Next.js / TypeScript on **Vercel**
- **Agent framework:** Vercel **AI SDK v6** (Anthropic models via our own key — no third party in the document data path)
- **Auth:** **Clerk**
- **State:** **Supabase** Postgres (kept; RLS + Storage reused, no migration)
- **Blobs:** **Supabase Storage** (`documents` bucket)
- **Training jobs:** a single SSE-streaming Next.js route handler (`maxDuration` raised,
  sample count capped) — no queue/Inngest. Add a queue only if batch volume demands it.

---

## 3. Topology

```
┌─ Next.js (Vercel) ── dashboard (Clerk auth) ─────────────────────────┐
│                                                                       │
├─ Shared Agent runtime (AI SDK v6) ── inference ──────────────────────┤
│    streamText({ system: account.rules,                               │
│                 messages: [file + few-shot],                         │
│                 experimental_output: Output.object(account.schema) })│
│                                                                       │
├─ Eval harness (TS, Inngest jobs) ── the IP ──────────────────────────┤
│    schema-infer · split · scorers · scoring · calibration            │
│      → writes the account config bundle + accuracy summary           │
│                                                                       │
└─ Postgres ── accounts · agents(config) · samples+ground_truth ·      │
     predictions · eval_runs · calibration     (blobs → Blob/R2)       │
```

No Fly orchestration, no Bridge, no per-tenant volumes.

---

## 4. Core concept — the per-account config bundle

There is **one** agent. An account's tuned "agent" is a config row that reshapes the shared agent at call time:

```
config bundle  =  {
  rules:        string        // tuned system prompt / extraction rules
  fewShot:      Example[]      // selected exemplars (doc + expected output)
  schema:       ZodSchema      // per-account field schema → Output.object()
  calibration:  CalibrationMap // emitted-confidence → empirical accuracy
}
```

"Training an account" = producing/updating this bundle. Inference = load the bundle, run the shared agent. A customer with several document types has several config rows, all served by the same runtime.

---

## 5. Agent runtime

- Defined once: model, base instructions, multimodal file input.
- Per call: inject the account's `rules`, `fewShot`, and `Output.object(schema)`.
- Output: structured fields **+ per-field confidence** (kept from the current design; confidence is part of the schema).
- No OCR — the document file (PDF/image bytes) is passed directly as a message part.

> Note: removing OCR means every training iteration **re-reads the file** (no cached text) — more tokens/latency in the loop. Acceptable at MVP scale. Cheap future mitigation: cache rendered page images. Do not build yet.

---

## 6. Eval harness (the IP)

```
1. Upload N samples + expected outputs
2. schema_infer:  union of expected-output keys → field schema (Zod) + per-field type
3. split:         80/20  (random MVP → stratified later)
4. BASELINE:      run shared agent over TRAIN → score → per-field accuracy
5. TUNE:          revise rules + select few-shot + (optional) strong-model orchestration
                  → re-run TRAIN → keep if improved → version the bundle
                  (stream scores up = the "watch accuracy climb" demo)
6. HELD-OUT:      best bundle on TEST, once → the honest number shown before payment
7. calibration:   bin emitted-confidence vs actual pass-rate → "95% confident == 95% right"
8. promote:       write active bundle + accuracy summary
9. PRODUCTION:    new docs → tuned bundle → route by calibrated confidence
                  (high → adapter · low → review queue) · corrections = new labelled samples
```

**Scorer matrix** (deterministic, no LLM-judging):

| Scorer | For |
|---|---|
| `exact` | enums, IDs, normalised strings |
| `numeric` | parse + tolerance (`$1,000.00` == `1000`) |
| `date` | normalise to ISO, then compare |
| `fuzzy` | token-set ratio for free-text fields |
| `presence` | missing field / hallucinated field |

Field accuracy = `mean(passed)` over the **held-out** set. Never tune on test.

---

## 7. Data model (Postgres, row-level scoped by Clerk user/org)

| Table | Purpose |
|---|---|
| `accounts` | Clerk-backed tenant |
| `agents` | per-account config bundle (rules, fewShot ref, schema, calibration, active_version, accuracy_summary) |
| `samples` | training/eval examples: doc ref + `expected_output` JSON + split |
| `predictions` | agent output per sample per run |
| `eval_runs` | run metadata + overall + per-field scores |
| `documents` | production docs + status (no `ocr_results` table) |
| `review_queue` | low-confidence items awaiting human review |

---

## 8. What changes from the current repo

- **Retire the Python inference path** (FastAPI + Claude Agent SDK extraction agent). `streamText + Output.object` replaces the custom save/set/delete tool loop.
- **Remove OCR**: delete Mistral integration, `services/ocr.py`, the `ocr_results` table and caching.
- **Keep:** Next.js frontend, Clerk auth, the confidence-per-field concept, the corrections-as-labels insight (every correction → a new `sample`, feeds drift detection later).

---

## 9. MVP cut

**Ship first (the §3 trust moment):** upload samples → schema infer → 80/20 → baseline run → the 5 scorers → **held-out accuracy number**, streamed. Plus run-tuned-bundle-on-new-docs.

**Defer:** strong-model auto-tuning loop, calibration, drift detection (built on corrections), stratified sampling, adapters beyond CSV/JSON + webhook.

---

## 10. Open decisions

1. **Postgres:** RESOLVED — keep **Supabase** (RLS + Storage reused, no migration).
2. **Blobs:** RESOLVED — **Supabase Storage** (`documents` bucket).
3. **Strong-model tuning orchestrator:** still open — when to add (v1.1) and which model drives the rule-tuning step. The current orchestrator promotes a bundle of inferred schema + few-shot exemplars without LLM rule tuning.
