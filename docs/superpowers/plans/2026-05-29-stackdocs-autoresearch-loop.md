# StackDocs Autoresearch Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-agent, greedy hill-climb optimization loop that tunes a per-agent config bundle against a frozen gold-document eval harness — keeping a candidate only when held-out accuracy improves and no guardrail (gate) regresses.

**Architecture:** A portable TypeScript engine under `frontend/lib/harness/loop/`, layered on the existing harness (`scorers`, `scoring`, `schema-infer`, `split`) and agent runtime (`agent/runtime`). The engine (`engine.ts`), graph (`tree.ts`), and gates (`gates.ts`) are deterministic and unit-tested with fake evaluator/mutator (zero API calls). The only LLM-touching modules — `evaluator.ts` and `mutator.ts` — sit behind injectable interfaces. A CLI (`scripts/tune.ts`) drives the loop for the internal build-tool (delivery A); the identical engine later powers an SSE route (delivery B, deferred).

**Tech Stack:** TypeScript, Next.js 16, Vitest, Supabase (Postgres + Storage), Vercel AI SDK v6 (`ai`), `@ai-sdk/anthropic`, Zod.

**Spec:** `docs/superpowers/specs/2026-05-29-stackdocs-autoresearch-loop-design.md` (ship spec).

**Scope note (deviation from ship-spec §11):** the mutator implements three mutation kinds — `rules`, `fewShotSampleIds`, `schemaHints` (per-field type/required). Generation of executable guardrail *tools* is moved to the defer spec (it needs a code-sandboxing design). Custom invariants remain expressible as declarative gates.

**Working directory for all commands:** `frontend/` (the Next.js app). Tests run with Vitest; a single test file runs via `npx vitest run <path>`.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/017_autoresearch_loop.sql` | Bundle-tree columns, `agent_evaluators` table, `eval_runs.gate_results` |
| `frontend/lib/harness/loop/types.ts` | Shared types (`Bundle`, `Gate`, `SealedEvaluator`, `ExperimentResult`, `MutationProposal`, `BundlePatch`, `LoopEvent`, `LoopConfig`, `LoopState`, `LoopDeps`, `TreeStore`) |
| `frontend/lib/harness/loop/gates.ts` | `checkGates(gates, ctx)` — pure guardrail evaluation |
| `frontend/lib/harness/loop/tree.ts` | `compareScores`, `applyBundlePatch` (pure) + `SupabaseTreeStore` (DB persistence) |
| `frontend/lib/harness/loop/evaluator.ts` | `evaluate(bundle, sealed, deps)` — frozen benchmark (runs agent over held-out, scores, checks gates) |
| `frontend/lib/harness/loop/mutator.ts` | `proposeMutation(state, deps)` — LLM proposes one typed bundle patch |
| `frontend/lib/harness/loop/setup.ts` | `buildDefaultGates`, `setupEvaluator` — Phase-0 sealing + baseline |
| `frontend/lib/harness/loop/engine.ts` | `runLoop(args)` — the orchestrator loop generator |
| `frontend/scripts/tune.ts` | CLI entry for delivery A |
| `frontend/lib/harness/loop/__tests__/*.test.ts` | Deterministic unit tests |

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/017_autoresearch_loop.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration 017: Autoresearch loop
-- Adds the bundle-version tree (status/parent/score/hypothesis/eval_epoch),
-- the sealed frozen evaluator table, and per-experiment gate results.

ALTER TABLE agent_bundles
    ADD COLUMN IF NOT EXISTS parent_version INTEGER,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'committed'
        CHECK (status IN ('baseline', 'candidate', 'committed', 'discarded')),
    ADD COLUMN IF NOT EXISTS score NUMERIC,
    ADD COLUMN IF NOT EXISTS hypothesis TEXT,
    ADD COLUMN IF NOT EXISTS eval_epoch INTEGER NOT NULL DEFAULT 1;

ALTER TABLE eval_runs
    ADD COLUMN IF NOT EXISTS gate_results JSONB DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS agent_evaluators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    eval_epoch INTEGER NOT NULL DEFAULT 1,
    field_schema JSONB NOT NULL,
    gates JSONB NOT NULL DEFAULT '[]'::jsonb,
    review_threshold NUMERIC NOT NULL DEFAULT 0.7,
    split_seed INTEGER NOT NULL DEFAULT 42,
    train_sample_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    held_out_sample_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    strategy_doc TEXT,
    sealed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_evaluators_agent
    ON agent_evaluators(agent_id, eval_epoch DESC);

ALTER TABLE agent_evaluators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_evaluators_owner ON agent_evaluators;
CREATE POLICY agent_evaluators_owner ON agent_evaluators
    FOR ALL TO authenticated USING ((SELECT auth.jwt()->>'sub') = user_id);
```

- [ ] **Step 2: Verify the SQL parses**

Run (from repo root): `psql --version` to confirm tooling, then review the file against `supabase/migrations/016_gtm_tier1_tier2.sql` for style consistency (RLS policy name pattern, `IF NOT EXISTS`). Apply to a Supabase project via the dashboard SQL editor or `supabase db push` when ready.
Expected: no syntax errors; `agent_evaluators` created with RLS enabled.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/017_autoresearch_loop.sql
git commit -m "feat(loop): add migration 017 for autoresearch loop schema"
```

---

## Task 2: Shared types

**Files:**
- Create: `frontend/lib/harness/loop/types.ts`

- [ ] **Step 1: Write the types**

```ts
// Shared types for the autoresearch optimization loop.
import type { FieldSchema, FieldType, ScoreResult } from "../types";

export type BundleStatus = "baseline" | "candidate" | "committed" | "discarded";

/** The mutable artifact the loop optimizes. */
export interface Bundle {
  version: number;
  parentVersion: number | null;
  rules: string | null;
  fewShotSampleIds: string[];
  fieldSchema: FieldSchema;
  status: BundleStatus;
  score: number | null;
  hypothesis: string | null;
  evalEpoch: number;
}

/** Declarative guardrails. A failing gate rejects a candidate regardless of score. */
export type Gate =
  | { kind: "field_floor"; field: string; min: number }
  | { kind: "review_rate_ceiling"; max: number }
  | { kind: "schema_valid" };

export interface GateResult {
  gate: Gate;
  passed: boolean;
  observed: number | boolean;
}

/** One frozen gold document + its ground-truth output. */
export interface EvalSample {
  id: string;
  filePath: string;
  filename: string;
  mediaType: string;
  expectedOutput: Record<string, unknown>;
}

/** The sealed, frozen evaluator. Written once in Phase 0, read-only thereafter. */
export interface SealedEvaluator {
  agentId: string;
  userId: string;
  evalEpoch: number;
  fieldSchema: FieldSchema; // scorer per field is FieldSpec.type
  gates: Gate[];
  reviewThreshold: number;
  heldOut: EvalSample[];
  train: EvalSample[];
  strategyDoc: string;
}

export interface ExperimentResult {
  score: number; // held-out overall accuracy
  perField: ScoreResult["perField"];
  reviewRate: number;
  schemaValid: boolean;
  gateResults: GateResult[];
  passed: boolean; // all gates passed
}

export interface BundlePatch {
  rules?: string | null;
  fewShotSampleIds?: string[];
  schemaHints?: Array<{ field: string; type?: FieldType; required?: boolean }>;
}

export interface MutationProposal {
  patch: BundlePatch;
  hypothesis: string;
}

export type LoopEvent =
  | { type: "experiment_started"; version: number; hypothesis: string; parentVersion: number | null }
  | { type: "scored"; version: number; score: number; perField: ScoreResult["perField"] }
  | { type: "gate_results"; version: number; gateResults: GateResult[] }
  | { type: "committed"; version: number; score: number; hypothesis: string }
  | { type: "discarded"; version: number; reason: string; hypothesis: string }
  | { type: "stalled"; round: number }
  | { type: "complete"; bestVersion: number | null; bestScore: number | null; experiments: number };

export interface LoopConfig {
  stallLimit: number;
  maxIterations: number;
  maxWallClockMs: number;
  epsilon: number; // minimum score improvement required to commit
}

export interface LoopState {
  best: Bundle;
  sealed: SealedEvaluator;
  lastResult: ExperimentResult;
  whatNotToTry: string[];
}

/** Persistence boundary for the bundle-version tree. */
export interface TreeStore {
  insertCandidate(patch: BundlePatch, hypothesis: string, parent: Bundle): Promise<Bundle>;
  commit(version: number, score: number): Promise<void>;
  discard(version: number, reason: string): Promise<void>;
}

export interface LoopDeps {
  evaluator: (bundle: Bundle, sealed: SealedEvaluator) => Promise<ExperimentResult>;
  mutator: (state: LoopState) => Promise<MutationProposal>;
  tree: TreeStore;
  now: () => number;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors (a types-only file has no runtime test; tsc is the check).

- [ ] **Step 3: Commit**

```bash
git add lib/harness/loop/types.ts
git commit -m "feat(loop): add shared loop types"
```

---

## Task 3: Gates (pure guardrail evaluation)

**Files:**
- Create: `frontend/lib/harness/loop/gates.ts`
- Test: `frontend/lib/harness/loop/__tests__/gates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { checkGates, type GateContext } from "../gates";
import type { Gate } from "../types";

const ctx = (overrides: Partial<GateContext> = {}): GateContext => ({
  score: {
    overallAccuracy: 0.9,
    perField: {
      invoice_date: { passed: 9, total: 10, accuracy: 0.9, scorer: "date" },
      total: { passed: 7, total: 10, accuracy: 0.7, scorer: "numeric" },
    },
  },
  reviewRate: 0.1,
  schemaValid: true,
  ...overrides,
});

describe("checkGates", () => {
  it("passes a field_floor when accuracy meets the minimum", () => {
    const gates: Gate[] = [{ kind: "field_floor", field: "invoice_date", min: 0.85 }];
    const [res] = checkGates(gates, ctx());
    expect(res.passed).toBe(true);
    expect(res.observed).toBe(0.9);
  });

  it("fails a field_floor when accuracy is below the minimum", () => {
    const gates: Gate[] = [{ kind: "field_floor", field: "total", min: 0.85 }];
    const [res] = checkGates(gates, ctx());
    expect(res.passed).toBe(false);
    expect(res.observed).toBe(0.7);
  });

  it("fails review_rate_ceiling when review rate exceeds max", () => {
    const gates: Gate[] = [{ kind: "review_rate_ceiling", max: 0.2 }];
    const [res] = checkGates(gates, ctx({ reviewRate: 0.5 }));
    expect(res.passed).toBe(false);
    expect(res.observed).toBe(0.5);
  });

  it("fails schema_valid when an output did not conform", () => {
    const gates: Gate[] = [{ kind: "schema_valid" }];
    const [res] = checkGates(gates, ctx({ schemaValid: false }));
    expect(res.passed).toBe(false);
  });

  it("treats a missing field as accuracy 0 (fails the floor)", () => {
    const gates: Gate[] = [{ kind: "field_floor", field: "absent", min: 0.5 }];
    const [res] = checkGates(gates, ctx());
    expect(res.passed).toBe(false);
    expect(res.observed).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/harness/loop/__tests__/gates.test.ts`
Expected: FAIL — `Cannot find module '../gates'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// Declarative guardrail evaluation. Pure: no I/O, no LLM.
import type { Gate, GateResult } from "./types";
import type { ScoreResult } from "../types";

export interface GateContext {
  score: ScoreResult;
  reviewRate: number;
  schemaValid: boolean;
}

export function checkGates(gates: Gate[], ctx: GateContext): GateResult[] {
  return gates.map((gate) => {
    switch (gate.kind) {
      case "field_floor": {
        const observed = ctx.score.perField[gate.field]?.accuracy ?? 0;
        return { gate, passed: observed >= gate.min, observed };
      }
      case "review_rate_ceiling": {
        const observed = ctx.reviewRate;
        return { gate, passed: observed <= gate.max, observed };
      }
      case "schema_valid": {
        return { gate, passed: ctx.schemaValid, observed: ctx.schemaValid };
      }
    }
  });
}

export function allGatesPassed(results: GateResult[]): boolean {
  return results.every((r) => r.passed);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/harness/loop/__tests__/gates.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/harness/loop/gates.ts lib/harness/loop/__tests__/gates.test.ts
git commit -m "feat(loop): add declarative gate evaluation"
```

---

## Task 4: Tree — pure helpers (compareScores, applyBundlePatch)

**Files:**
- Create: `frontend/lib/harness/loop/tree.ts`
- Test: `frontend/lib/harness/loop/__tests__/tree.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { applyBundlePatch, compareScores } from "../tree";
import type { Bundle } from "../types";

const base: Bundle = {
  version: 1,
  parentVersion: null,
  rules: null,
  fewShotSampleIds: ["a", "b"],
  fieldSchema: [
    { name: "total", type: "numeric", required: true },
    { name: "vendor", type: "exact", required: true },
  ],
  status: "committed",
  score: 0.8,
  hypothesis: null,
  evalEpoch: 1,
};

describe("compareScores", () => {
  it("accepts a candidate that beats parent by at least epsilon", () => {
    expect(compareScores(0.82, 0.8, 0.01)).toBe(true);
  });
  it("rejects a candidate within epsilon of parent (noise)", () => {
    expect(compareScores(0.805, 0.8, 0.01)).toBe(false);
  });
  it("rejects a worse candidate", () => {
    expect(compareScores(0.75, 0.8, 0.01)).toBe(false);
  });
});

describe("applyBundlePatch", () => {
  it("overwrites rules when provided", () => {
    const next = applyBundlePatch(base, { rules: "use ISO dates" });
    expect(next.rules).toBe("use ISO dates");
    expect(next.fewShotSampleIds).toEqual(["a", "b"]);
  });
  it("replaces few-shot selection when provided", () => {
    const next = applyBundlePatch(base, { fewShotSampleIds: ["c"] });
    expect(next.fewShotSampleIds).toEqual(["c"]);
  });
  it("applies schema hints to matching fields only", () => {
    const next = applyBundlePatch(base, { schemaHints: [{ field: "total", required: false }] });
    const total = next.fieldSchema.find((f) => f.name === "total");
    const vendor = next.fieldSchema.find((f) => f.name === "vendor");
    expect(total?.required).toBe(false);
    expect(vendor?.required).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/harness/loop/__tests__/tree.test.ts`
Expected: FAIL — `Cannot find module '../tree'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// Bundle-version tree: pure helpers + Supabase-backed persistence.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bundle, BundlePatch, TreeStore } from "./types";

/** Keep a candidate only if it beats parent by at least epsilon (noise guard). */
export function compareScores(candidate: number, parent: number, epsilon: number): boolean {
  return candidate >= parent + epsilon;
}

type MutableBundleFields = Pick<Bundle, "rules" | "fewShotSampleIds" | "fieldSchema">;

/** Apply a typed patch onto a parent bundle, returning the mutated mutable fields. */
export function applyBundlePatch(parent: Bundle, patch: BundlePatch): MutableBundleFields {
  const rules = patch.rules !== undefined ? patch.rules : parent.rules;
  const fewShotSampleIds = patch.fewShotSampleIds ?? parent.fewShotSampleIds;
  let fieldSchema = parent.fieldSchema;
  if (patch.schemaHints && patch.schemaHints.length > 0) {
    fieldSchema = parent.fieldSchema.map((f) => {
      const hint = patch.schemaHints!.find((h) => h.field === f.name);
      if (!hint) return f;
      return {
        ...f,
        type: hint.type ?? f.type,
        required: hint.required ?? f.required,
      };
    });
  }
  return { rules, fewShotSampleIds, fieldSchema };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/harness/loop/__tests__/tree.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/harness/loop/tree.ts lib/harness/loop/__tests__/tree.test.ts
git commit -m "feat(loop): add pure tree helpers (compareScores, applyBundlePatch)"
```

---

## Task 5: Tree — Supabase-backed TreeStore

**Files:**
- Modify: `frontend/lib/harness/loop/tree.ts` (append)

- [ ] **Step 1: Append the TreeStore implementation**

```ts
/** Persists the bundle-version tree to agent_bundles. Server-side (service-role db). */
export class SupabaseTreeStore implements TreeStore {
  constructor(
    private db: SupabaseClient,
    private agentId: string,
    private userId: string,
    private evalEpoch: number,
  ) {}

  private async nextVersion(): Promise<number> {
    const { data } = await this.db
      .from("agent_bundles")
      .select("version")
      .eq("agent_id", this.agentId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    return ((data?.version as number | undefined) ?? 0) + 1;
  }

  async insertCandidate(patch: BundlePatch, hypothesis: string, parent: Bundle): Promise<Bundle> {
    const merged = applyBundlePatch(parent, patch);
    const version = await this.nextVersion();
    const candidate: Bundle = {
      version,
      parentVersion: parent.version,
      rules: merged.rules,
      fewShotSampleIds: merged.fewShotSampleIds,
      fieldSchema: merged.fieldSchema,
      status: "candidate",
      score: null,
      hypothesis,
      evalEpoch: this.evalEpoch,
    };
    await this.db.from("agent_bundles").insert({
      agent_id: this.agentId,
      user_id: this.userId,
      version,
      parent_version: parent.version,
      rules: merged.rules,
      few_shot_sample_ids: merged.fewShotSampleIds,
      field_schema: merged.fieldSchema,
      status: "candidate",
      hypothesis,
      eval_epoch: this.evalEpoch,
    });
    return candidate;
  }

  async commit(version: number, score: number): Promise<void> {
    await this.db
      .from("agent_bundles")
      .update({ status: "committed", score })
      .eq("agent_id", this.agentId)
      .eq("version", version);
  }

  async discard(version: number, reason: string): Promise<void> {
    await this.db
      .from("agent_bundles")
      .update({ status: "discarded", hypothesis: reason })
      .eq("agent_id", this.agentId)
      .eq("version", version);
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors. (DB persistence is exercised by the integration script in Task 10, not a unit test — it needs a live Supabase.)

- [ ] **Step 3: Commit**

```bash
git add lib/harness/loop/tree.ts
git commit -m "feat(loop): add Supabase-backed TreeStore"
```

---

## Task 6: Evaluator (frozen benchmark)

**Files:**
- Create: `frontend/lib/harness/loop/evaluator.ts`
- Test: `frontend/lib/harness/loop/__tests__/evaluator.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { evaluate, type EvaluatorDeps } from "../evaluator";
import type { Bundle, SealedEvaluator } from "../types";

const sealed: SealedEvaluator = {
  agentId: "agent-1",
  userId: "user-1",
  evalEpoch: 1,
  fieldSchema: [
    { name: "vendor", type: "exact", required: true },
    { name: "total", type: "numeric", required: true },
  ],
  gates: [{ kind: "field_floor", field: "total", min: 0.5 }],
  reviewThreshold: 0.7,
  heldOut: [
    { id: "s1", filePath: "p1", filename: "f1.pdf", mediaType: "application/pdf", expectedOutput: { vendor: "Acme", total: "$100" } },
    { id: "s2", filePath: "p2", filename: "f2.pdf", mediaType: "application/pdf", expectedOutput: { vendor: "Globex", total: "$200" } },
  ],
  train: [],
  strategyDoc: "",
};

const bundle: Bundle = {
  version: 2, parentVersion: 1, rules: null, fewShotSampleIds: [],
  fieldSchema: sealed.fieldSchema, status: "candidate", score: null, hypothesis: "x", evalEpoch: 1,
};

describe("evaluate", () => {
  it("scores held-out docs, computes review rate, and passes gates when fields are correct", async () => {
    const deps: EvaluatorDeps = {
      runOne: async (sample) => ({
        extractedFields: sample.expectedOutput, // perfect extraction
        confidenceScores: { vendor: 0.95, total: 0.9 },
        minConfidence: 0.9,
      }),
    };
    const res = await evaluate(bundle, sealed, deps);
    expect(res.score).toBe(1);
    expect(res.perField.total.accuracy).toBe(1);
    expect(res.reviewRate).toBe(0); // both above 0.7 threshold
    expect(res.passed).toBe(true);
  });

  it("fails the gate and flags review when a field is wrong and confidence is low", async () => {
    const deps: EvaluatorDeps = {
      runOne: async () => ({
        extractedFields: { vendor: "Acme", total: "wrong" },
        confidenceScores: { vendor: 0.95, total: 0.2 },
        minConfidence: 0.2,
      }),
    };
    const res = await evaluate(bundle, sealed, deps);
    expect(res.perField.total.accuracy).toBe(0);
    expect(res.reviewRate).toBe(1); // every doc below threshold
    expect(res.passed).toBe(false); // total floor 0.5 not met
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/harness/loop/__tests__/evaluator.test.ts`
Expected: FAIL — `Cannot find module '../evaluator'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// The frozen benchmark: run the tuned bundle over the held-out gold docs with a
// FRESH agent session per doc, score with the frozen scorers, and check gates.
import { scoreRun, type SampleEval } from "../scoring";
import { flatten } from "../flatten";
import { runAgent } from "../../agent/runtime";
import { getAgentTools } from "../../agent/tools/registry";
import { downloadFileBytes } from "../../supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkGates, allGatesPassed } from "./gates";
import type { Bundle, EvalSample, ExperimentResult, SealedEvaluator } from "./types";

interface RunOneResult {
  extractedFields: Record<string, unknown>;
  confidenceScores: Record<string, unknown>;
  minConfidence: number;
}

export interface EvaluatorDeps {
  /** Run the agent over one held-out doc. Injected so the loop is unit-testable. */
  runOne: (sample: EvalSample, bundle: Bundle, sealed: SealedEvaluator) => Promise<RunOneResult>;
}

/** True when every required field is present (non-missing) in the output. */
function isSchemaValid(sealed: SealedEvaluator, actual: Record<string, unknown>): boolean {
  const flat = flatten(actual ?? {});
  return sealed.fieldSchema
    .filter((f) => f.required)
    .every((f) => f.name in flat && flat[f.name] !== null && flat[f.name] !== "");
}

export async function evaluate(
  bundle: Bundle,
  sealed: SealedEvaluator,
  deps: EvaluatorDeps,
): Promise<ExperimentResult> {
  const evals: SampleEval[] = [];
  let reviewCount = 0;
  let schemaValid = true;

  for (const sample of sealed.heldOut) {
    const out = await deps.runOne(sample, bundle, sealed);
    evals.push({ sampleId: sample.id, expected: sample.expectedOutput, actual: out.extractedFields });
    if (out.minConfidence < sealed.reviewThreshold) reviewCount += 1;
    if (!isSchemaValid(sealed, out.extractedFields)) schemaValid = false;
  }

  const { result } = scoreRun(sealed.fieldSchema, evals);
  const reviewRate = sealed.heldOut.length === 0 ? 0 : reviewCount / sealed.heldOut.length;
  const gateResults = checkGates(sealed.gates, { score: result, reviewRate, schemaValid });

  return {
    score: result.overallAccuracy,
    perField: result.perField,
    reviewRate,
    schemaValid,
    gateResults,
    passed: allGatesPassed(gateResults),
  };
}

/** Production `runOne`: downloads the doc and runs a fresh agent session. */
export function makeLiveRunOne(db: SupabaseClient, agentId: string): EvaluatorDeps["runOne"] {
  const tools = getAgentTools(agentId);
  return async (sample, bundle) => {
    const bytes = await downloadFileBytes(db, sample.filePath);
    const res = await runAgent({
      fieldSchema: bundle.fieldSchema,
      rules: bundle.rules,
      fewShot: [], // few-shot expected-output resolution happens in setup/CLI wiring
      file: { data: bytes, mediaType: sample.mediaType },
      filename: sample.filename,
      tools,
    });
    return {
      extractedFields: res.extractedFields,
      confidenceScores: res.confidenceScores,
      minConfidence: res.minConfidence,
    };
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/harness/loop/__tests__/evaluator.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/harness/loop/evaluator.ts lib/harness/loop/__tests__/evaluator.test.ts
git commit -m "feat(loop): add frozen-benchmark evaluator with injectable runOne"
```

---

## Task 7: Mutator (LLM proposes one typed patch)

**Files:**
- Create: `frontend/lib/harness/loop/mutator.ts`
- Test: `frontend/lib/harness/loop/__tests__/mutator.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { parseProposal, proposeMutation, type MutatorDeps } from "../mutator";
import type { LoopState } from "../types";

const state: LoopState = {
  best: {
    version: 1, parentVersion: null, rules: null, fewShotSampleIds: ["a"],
    fieldSchema: [{ name: "total", type: "numeric", required: true }],
    status: "committed", score: 0.8, hypothesis: null, evalEpoch: 1,
  },
  sealed: {
    agentId: "a", userId: "u", evalEpoch: 1,
    fieldSchema: [{ name: "total", type: "numeric", required: true }],
    gates: [], reviewThreshold: 0.7, heldOut: [], train: [], strategyDoc: "",
  },
  lastResult: {
    score: 0.8,
    perField: { total: { passed: 8, total: 10, accuracy: 0.8, scorer: "numeric" } },
    reviewRate: 0.1, schemaValid: true, gateResults: [], passed: true,
  },
  whatNotToTry: [],
};

describe("parseProposal", () => {
  it("parses a valid JSON proposal", () => {
    const p = parseProposal('{"hypothesis":"tighten total rule","patch":{"rules":"Sum line items."}}');
    expect(p?.patch.rules).toBe("Sum line items.");
    expect(p?.hypothesis).toBe("tighten total rule");
  });
  it("returns null for malformed JSON", () => {
    expect(parseProposal("not json")).toBeNull();
  });
  it("returns null when patch has no recognized keys", () => {
    expect(parseProposal('{"hypothesis":"x","patch":{"bogus":1}}')).toBeNull();
  });
});

describe("proposeMutation", () => {
  it("returns the parsed proposal from the model", async () => {
    const deps: MutatorDeps = {
      generate: async () => '{"hypothesis":"add date rule","patch":{"rules":"Dates are ISO."}}',
    };
    const proposal = await proposeMutation(state, deps);
    expect(proposal.hypothesis).toBe("add date rule");
    expect(proposal.patch.rules).toBe("Dates are ISO.");
  });

  it("throws when the model never returns a valid proposal", async () => {
    const deps: MutatorDeps = { generate: async () => "garbage" };
    await expect(proposeMutation(state, deps)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/harness/loop/__tests__/mutator.test.ts`
Expected: FAIL — `Cannot find module '../mutator'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// The mutator: a strong model reads the current best bundle, its per-field
// scores, and what-not-to-try, and proposes ONE typed patch to the bundle.
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { modelId } from "../../agent/models";
import type { LoopState, MutationProposal } from "./types";

const PATCH_KEYS = ["rules", "fewShotSampleIds", "schemaHints"] as const;

/** Strict parse + validate of the model's JSON proposal. Returns null if invalid. */
export function parseProposal(text: string): MutationProposal | null {
  const match = text.trim().match(/\{[\s\S]*\}/);
  if (!match) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  const hypothesis = typeof obj.hypothesis === "string" ? obj.hypothesis : null;
  const patch = typeof obj.patch === "object" && obj.patch !== null ? (obj.patch as Record<string, unknown>) : null;
  if (!hypothesis || !patch) return null;
  const hasKnownKey = PATCH_KEYS.some((k) => k in patch);
  if (!hasKnownKey) return null;
  return { patch: patch as MutationProposal["patch"], hypothesis };
}

export interface MutatorDeps {
  /** Returns the model's raw text. Injected so the loop is unit-testable. */
  generate: (prompt: string) => Promise<string>;
}

function buildPrompt(state: LoopState): string {
  const fields = Object.entries(state.lastResult.perField)
    .map(([name, s]) => `  - ${name} (${s.scorer}): ${(s.accuracy * 100).toFixed(0)}%`)
    .sort()
    .join("\n");
  const avoid = state.whatNotToTry.length
    ? `\nApproaches already tried and discarded (do NOT repeat):\n${state.whatNotToTry.map((h) => `  - ${h}`).join("\n")}`
    : "";
  return [
    `You are tuning a document-extraction agent. Goal: raise held-out accuracy.`,
    state.sealed.strategyDoc ? `\nStrategy:\n${state.sealed.strategyDoc}` : "",
    `\nCurrent overall accuracy: ${(state.lastResult.score * 100).toFixed(1)}%`,
    `Per-field accuracy:\n${fields}`,
    `\nCurrent rules:\n${state.best.rules ?? "(none)"}`,
    avoid,
    `\nPropose exactly ONE change targeting the weakest field or biggest failure cluster.`,
    `You may change: "rules" (string), "fewShotSampleIds" (array of sample ids), or`,
    `"schemaHints" (array of {field, type?, required?}). Make a single focused change.`,
    `\nReturn ONLY a JSON object: {"hypothesis": "<one line>", "patch": { ... }}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const MAX_ATTEMPTS = 3;

export async function proposeMutation(state: LoopState, deps: MutatorDeps): Promise<MutationProposal> {
  const prompt = buildPrompt(state);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const text = await deps.generate(prompt);
    const proposal = parseProposal(text);
    if (proposal) return proposal;
  }
  throw new Error("mutator: no valid proposal after retries");
}

/** Production generate: calls the strong tuning model via the AI SDK. */
export function makeLiveGenerate(signal?: AbortSignal): MutatorDeps["generate"] {
  return async (prompt) => {
    const { text } = await generateText({
      model: anthropic(modelId("tuning")),
      abortSignal: signal,
      prompt,
    });
    return text;
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/harness/loop/__tests__/mutator.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/harness/loop/mutator.ts lib/harness/loop/__tests__/mutator.test.ts
git commit -m "feat(loop): add LLM mutator with strict proposal parsing"
```

---

## Task 8: Engine (the orchestrator loop)

**Files:**
- Create: `frontend/lib/harness/loop/engine.ts`
- Test: `frontend/lib/harness/loop/__tests__/engine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { runLoop } from "../engine";
import type {
  Bundle, BundlePatch, ExperimentResult, LoopConfig, LoopDeps,
  MutationProposal, SealedEvaluator, TreeStore,
} from "../types";

const sealed: SealedEvaluator = {
  agentId: "a", userId: "u", evalEpoch: 1,
  fieldSchema: [{ name: "total", type: "numeric", required: true }],
  gates: [], reviewThreshold: 0.7, heldOut: [], train: [], strategyDoc: "",
};

const baseline: Bundle = {
  version: 1, parentVersion: null, rules: null, fewShotSampleIds: [],
  fieldSchema: sealed.fieldSchema, status: "committed", score: 0.8,
  hypothesis: null, evalEpoch: 1,
};

const baselineResult: ExperimentResult = {
  score: 0.8, perField: { total: { passed: 8, total: 10, accuracy: 0.8, scorer: "numeric" } },
  reviewRate: 0.1, schemaValid: true, gateResults: [], passed: true,
};

// In-memory tree: assigns incrementing versions, records commit/discard calls.
function fakeTree(): TreeStore & { commits: number[]; discards: Array<[number, string]> } {
  let v = 1;
  const commits: number[] = [];
  const discards: Array<[number, string]> = [];
  return {
    commits, discards,
    async insertCandidate(_patch: BundlePatch, hypothesis: string, parent: Bundle): Promise<Bundle> {
      v += 1;
      return { ...parent, version: v, parentVersion: parent.version, status: "candidate", score: null, hypothesis };
    },
    async commit(version: number) { commits.push(version); },
    async discard(version: number, reason: string) { discards.push([version, reason]); },
  };
}

const config: LoopConfig = { stallLimit: 2, maxIterations: 50, maxWallClockMs: 1e9, epsilon: 0.01 };

const proposal: MutationProposal = { patch: { rules: "x" }, hypothesis: "try x" };

function collect(gen: AsyncGenerator<unknown>) {
  return (async () => { const out: unknown[] = []; for await (const e of gen) out.push(e); return out; })();
}

describe("runLoop", () => {
  it("commits a candidate that improves the score and resets stall", async () => {
    const tree = fakeTree();
    let calls = 0;
    const deps: LoopDeps = {
      tree, now: () => 0,
      mutator: async () => proposal,
      evaluator: async (bundle) => {
        calls += 1;
        // First candidate improves to 0.9 (commit), then stall with no improvement.
        const score = calls === 1 ? 0.9 : 0.9;
        return { ...baselineResult, score, perField: { total: { passed: 9, total: 10, accuracy: 0.9, scorer: "numeric" } } };
      },
    };
    const events = await collect(runLoop({ config, sealed, best: baseline, baselineResult, deps }));
    expect(tree.commits).toContain(2); // first candidate committed
    const completed = events.find((e: any) => e.type === "complete") as any;
    expect(completed.bestScore).toBe(0.9);
  });

  it("discards a candidate that fails a gate even if score improved", async () => {
    const tree = fakeTree();
    const deps: LoopDeps = {
      tree, now: () => 0,
      mutator: async () => proposal,
      evaluator: async () => ({ ...baselineResult, score: 0.99, passed: false }),
    };
    await collect(runLoop({ config, sealed, best: baseline, baselineResult, deps }));
    expect(tree.commits).toHaveLength(0);
    expect(tree.discards[0][1]).toBe("gate_failed");
  });

  it("stops after stallLimit consecutive non-improving rounds", async () => {
    const tree = fakeTree();
    const deps: LoopDeps = {
      tree, now: () => 0,
      mutator: async () => proposal,
      evaluator: async () => ({ ...baselineResult, score: 0.8, passed: true }), // never beats baseline
    };
    const events = await collect(runLoop({ config, sealed, best: baseline, baselineResult, deps }));
    const completed = events.find((e: any) => e.type === "complete") as any;
    expect(completed.experiments).toBe(2); // stallLimit = 2
    expect(tree.commits).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/harness/loop/__tests__/engine.test.ts`
Expected: FAIL — `Cannot find module '../engine'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// The orchestrator loop: greedy hill-climb. Pure control flow over injected
// evaluator/mutator/tree, so it is fully unit-testable with no API calls.
import { compareScores } from "./tree";
import type { Bundle, ExperimentResult, LoopConfig, LoopDeps, LoopEvent, SealedEvaluator } from "./types";

export async function* runLoop(args: {
  config: LoopConfig;
  sealed: SealedEvaluator;
  best: Bundle;
  baselineResult: ExperimentResult;
  deps: LoopDeps;
}): AsyncGenerator<LoopEvent> {
  const { config, sealed, deps } = args;
  let best = args.best;
  let lastResult = args.baselineResult;
  const whatNotToTry: string[] = [];
  let stall = 0;
  let experiments = 0;
  const started = deps.now();

  while (
    stall < config.stallLimit &&
    experiments < config.maxIterations &&
    deps.now() - started < config.maxWallClockMs
  ) {
    const proposal = await deps.mutator({ best, sealed, lastResult, whatNotToTry });
    const candidate = await deps.tree.insertCandidate(proposal.patch, proposal.hypothesis, best);
    yield { type: "experiment_started", version: candidate.version, hypothesis: proposal.hypothesis, parentVersion: candidate.parentVersion };

    const result = await deps.evaluator(candidate, sealed);
    experiments += 1;
    yield { type: "scored", version: candidate.version, score: result.score, perField: result.perField };
    yield { type: "gate_results", version: candidate.version, gateResults: result.gateResults };

    if (!result.passed) {
      await deps.tree.discard(candidate.version, "gate_failed");
      whatNotToTry.push(proposal.hypothesis);
      stall += 1;
      yield { type: "discarded", version: candidate.version, reason: "gate_failed", hypothesis: proposal.hypothesis };
      yield { type: "stalled", round: stall };
      continue;
    }

    if (compareScores(result.score, best.score ?? 0, config.epsilon)) {
      await deps.tree.commit(candidate.version, result.score);
      best = { ...candidate, status: "committed", score: result.score };
      lastResult = result;
      stall = 0;
      yield { type: "committed", version: candidate.version, score: result.score, hypothesis: proposal.hypothesis };
    } else {
      await deps.tree.discard(candidate.version, "no_improvement");
      whatNotToTry.push(proposal.hypothesis);
      stall += 1;
      yield { type: "discarded", version: candidate.version, reason: "no_improvement", hypothesis: proposal.hypothesis };
      yield { type: "stalled", round: stall };
    }
  }

  yield { type: "complete", bestVersion: best.version, bestScore: best.score, experiments };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/harness/loop/__tests__/engine.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the whole loop suite**

Run: `npx vitest run lib/harness/loop`
Expected: PASS (all loop unit tests green).

- [ ] **Step 6: Commit**

```bash
git add lib/harness/loop/engine.ts lib/harness/loop/__tests__/engine.test.ts
git commit -m "feat(loop): add greedy hill-climb engine with keep/discard + stall"
```

---

## Task 9: Setup (Phase-0 sealing) — default gates + scorer map

**Files:**
- Create: `frontend/lib/harness/loop/setup.ts`
- Test: `frontend/lib/harness/loop/__tests__/setup.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildDefaultGates } from "../setup";
import type { FieldSchema } from "../../types";

const schema: FieldSchema = [
  { name: "vendor", type: "exact", required: true },
  { name: "total", type: "numeric", required: true },
];

describe("buildDefaultGates", () => {
  it("creates a field_floor per field plus review-rate and schema-valid gates", () => {
    const gates = buildDefaultGates(schema, { fieldFloor: 0.85, reviewMax: 0.2 });
    const floors = gates.filter((g) => g.kind === "field_floor");
    expect(floors).toHaveLength(2);
    expect(gates.some((g) => g.kind === "review_rate_ceiling")).toBe(true);
    expect(gates.some((g) => g.kind === "schema_valid")).toBe(true);
  });

  it("uses the provided field floor as each field's minimum", () => {
    const gates = buildDefaultGates(schema, { fieldFloor: 0.7, reviewMax: 0.2 });
    const total = gates.find((g) => g.kind === "field_floor" && g.field === "total");
    expect(total && total.kind === "field_floor" ? total.min : -1).toBe(0.7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/harness/loop/__tests__/setup.test.ts`
Expected: FAIL — `Cannot find module '../setup'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// Phase-0 setup: infer schema, split, build default gates, seal the evaluator,
// and run the baseline. Default gate floors track lib/audit/verdict.ts ("ready":
// overall >= 0.95, lowest field >= 0.85, review rate <= 0.2).
import type { SupabaseClient } from "@supabase/supabase-js";
import { inferSchema } from "../schema-infer";
import { splitSamples } from "../split";
import type { FieldSchema } from "../types";
import type { EvalSample, Gate, SealedEvaluator } from "./types";

export interface GateDefaults {
  fieldFloor: number; // per-field minimum accuracy
  reviewMax: number; // maximum review rate
}

export const DEFAULT_GATES: GateDefaults = { fieldFloor: 0.85, reviewMax: 0.2 };

export function buildDefaultGates(schema: FieldSchema, defaults: GateDefaults = DEFAULT_GATES): Gate[] {
  const floors: Gate[] = schema.map((f) => ({ kind: "field_floor", field: f.name, min: defaults.fieldFloor }));
  return [...floors, { kind: "review_rate_ceiling", max: defaults.reviewMax }, { kind: "schema_valid" }];
}

interface SampleRow {
  id: string;
  file_path: string;
  filename: string;
  media_type: string;
  expected_output: Record<string, unknown>;
}

function toEvalSample(r: SampleRow): EvalSample {
  return { id: r.id, filePath: r.file_path, filename: r.filename, mediaType: r.media_type, expectedOutput: r.expected_output };
}

/** Load samples, infer schema, split, build gates, and persist a sealed evaluator. */
export async function setupEvaluator(
  db: SupabaseClient,
  agentId: string,
  userId: string,
  opts: { gateDefaults?: GateDefaults; strategyDoc?: string; splitSeed?: number } = {},
): Promise<SealedEvaluator> {
  const { data, error } = await db
    .from("samples")
    .select("id, file_path, filename, media_type, expected_output")
    .eq("agent_id", agentId)
    .limit(60);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as SampleRow[];
  if (rows.length < 2) throw new Error("Need at least 2 samples (one held out).");

  const fieldSchema = inferSchema(rows.map((r) => ({ id: r.id, expectedOutput: r.expected_output })));
  const seed = opts.splitSeed ?? 42;
  const { train, test } = splitSamples(rows.map((r) => ({ id: r.id, expectedOutput: r.expected_output })), 0.8, seed);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const trainSamples = train.map((s) => toEvalSample(byId.get(s.id)!));
  const heldOut = test.map((s) => toEvalSample(byId.get(s.id)!));

  const gates = buildDefaultGates(fieldSchema, opts.gateDefaults ?? DEFAULT_GATES);

  const { data: lastEpoch } = await db
    .from("agent_evaluators")
    .select("eval_epoch")
    .eq("agent_id", agentId)
    .order("eval_epoch", { ascending: false })
    .limit(1)
    .maybeSingle();
  const evalEpoch = ((lastEpoch?.eval_epoch as number | undefined) ?? 0) + 1;

  const strategyDoc = opts.strategyDoc ?? "";
  await db.from("agent_evaluators").insert({
    agent_id: agentId,
    user_id: userId,
    eval_epoch: evalEpoch,
    field_schema: fieldSchema,
    gates,
    review_threshold: 0.7,
    split_seed: seed,
    train_sample_ids: trainSamples.map((s) => s.id),
    held_out_sample_ids: heldOut.map((s) => s.id),
    strategy_doc: strategyDoc,
  });

  return {
    agentId,
    userId,
    evalEpoch,
    fieldSchema,
    gates,
    reviewThreshold: 0.7,
    heldOut,
    train: trainSamples,
    strategyDoc,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/harness/loop/__tests__/setup.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/harness/loop/setup.ts lib/harness/loop/__tests__/setup.test.ts
git commit -m "feat(loop): add Phase-0 setup with default gates + sealed evaluator"
```

---

## Task 10: CLI entry point (delivery A) + baseline wiring

**Files:**
- Create: `frontend/scripts/tune.ts`
- Modify: `frontend/package.json` (add `tune` script)

- [ ] **Step 1: Write the CLI**

```ts
// Delivery A: drive the autoresearch loop from the terminal against a live
// Supabase + Anthropic stack. Usage:
//   npm run tune -- --agent <agentId> --user <userId> [--iters 30] [--stall 5]
import { createClient } from "@supabase/supabase-js";
import { setupEvaluator } from "../lib/harness/loop/setup";
import { evaluate, makeLiveRunOne } from "../lib/harness/loop/evaluator";
import { proposeMutation, makeLiveGenerate } from "../lib/harness/loop/mutator";
import { SupabaseTreeStore } from "../lib/harness/loop/tree";
import { runLoop } from "../lib/harness/loop/engine";
import type { Bundle, LoopConfig } from "../lib/harness/loop/types";

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`missing --${name}`);
}

async function main() {
  const agentId = arg("agent");
  const userId = arg("user");
  const config: LoopConfig = {
    stallLimit: Number(arg("stall", "5")),
    maxIterations: Number(arg("iters", "30")),
    maxWallClockMs: Number(arg("wallclock", String(2 * 60 * 60 * 1000))),
    epsilon: Number(arg("epsilon", "0.005")),
  };

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  console.log(`Setting up evaluator for agent ${agentId}...`);
  const sealed = await setupEvaluator(db, agentId, userId, {
    strategyDoc: "Extract every field exactly. Prefer document evidence over assumptions.",
  });
  console.log(`Sealed eval epoch ${sealed.evalEpoch}: ${sealed.heldOut.length} held-out, ${sealed.train.length} train, ${sealed.gates.length} gates.`);

  const runOne = makeLiveRunOne(db, agentId);
  const evaluator = (bundle: Bundle, s = sealed) => evaluate(bundle, s, { runOne });

  // Baseline bundle (version 1, no rules) as the root of the tree.
  const tree = new SupabaseTreeStore(db, agentId, userId, sealed.evalEpoch);
  const { data: existing } = await db
    .from("agent_bundles").select("version").eq("agent_id", agentId)
    .order("version", { ascending: false }).limit(1).maybeSingle();
  const baselineVersion = ((existing?.version as number | undefined) ?? 0) + 1;
  await db.from("agent_bundles").insert({
    agent_id: agentId, user_id: userId, version: baselineVersion,
    rules: null, few_shot_sample_ids: sealed.train.slice(0, 3).map((s) => s.id),
    field_schema: sealed.fieldSchema, status: "baseline", eval_epoch: sealed.evalEpoch,
  });
  const baseline: Bundle = {
    version: baselineVersion, parentVersion: null, rules: null,
    fewShotSampleIds: sealed.train.slice(0, 3).map((s) => s.id),
    fieldSchema: sealed.fieldSchema, status: "baseline", score: null,
    hypothesis: null, evalEpoch: sealed.evalEpoch,
  };

  console.log("Running baseline over held-out...");
  const baselineResult = await evaluator(baseline);
  await tree.commit(baselineVersion, baselineResult.score);
  baseline.status = "committed";
  baseline.score = baselineResult.score;
  console.log(`Baseline held-out accuracy: ${(baselineResult.score * 100).toFixed(1)}%`);

  const mutator = (state: Parameters<typeof proposeMutation>[0]) =>
    proposeMutation(state, { generate: makeLiveGenerate() });

  for await (const event of runLoop({
    config, sealed, best: baseline, baselineResult,
    deps: { evaluator, mutator, tree, now: () => Date.now() },
  })) {
    if (event.type === "scored") {
      console.log(`  v${event.version}: ${(event.score * 100).toFixed(1)}%`);
    } else if (event.type === "committed") {
      console.log(`✓ COMMIT v${event.version} ${(event.score * 100).toFixed(1)}% — ${event.hypothesis}`);
    } else if (event.type === "discarded") {
      console.log(`✗ discard v${event.version} (${event.reason})`);
    } else if (event.type === "complete") {
      console.log(`\nDone. Best v${event.bestVersion} @ ${((event.bestScore ?? 0) * 100).toFixed(1)}% over ${event.experiments} experiments.`);
    }
  }

  // Promote best committed bundle.
  const { data: bestBundle } = await db
    .from("agent_bundles").select("version, score")
    .eq("agent_id", agentId).eq("eval_epoch", sealed.evalEpoch).eq("status", "committed")
    .order("score", { ascending: false }).limit(1).maybeSingle();
  if (bestBundle?.version) {
    await db.from("agents").update({
      active_bundle_version: bestBundle.version, status: "trained",
      updated_at: new Date().toISOString(),
    }).eq("id", agentId);
    console.log(`Promoted v${bestBundle.version} as active bundle.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Add the npm script**

In `frontend/package.json`, add to `"scripts"` after the `"verify"` line:

```json
    "tune": "node --env-file=.env.local --import tsx scripts/tune.ts"
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/tune.ts package.json
git commit -m "feat(loop): add tune CLI for the internal build-tool (delivery A)"
```

---

## Task 11: Full suite + integration smoke

**Files:**
- (no new files)

- [ ] **Step 1: Run the complete unit suite**

Run: `npm test`
Expected: PASS — existing harness tests + all new loop tests (gates, tree, evaluator, mutator, engine, setup) green, zero API calls.

- [ ] **Step 2: Manual integration smoke (requires live keys)**

With `frontend/.env.local` populated (Supabase + `ANTHROPIC_API_KEY`) and an agent that has ≥ 3 uploaded samples:

Run: `npm run tune -- --agent <agentId> --user <userId> --iters 3 --stall 2`
Expected: prints a baseline accuracy, runs up to 3 experiments with commit/discard lines, prints a final best summary, and promotes a bundle. Verify in Supabase that `agent_evaluators` has a sealed row and `agent_bundles` has `candidate`/`committed`/`discarded` rows under the new `eval_epoch`.

- [ ] **Step 3: Commit any fixups**

```bash
git add -A
git commit -m "test(loop): full suite green + integration smoke verified"
```

---

## Notes for the executor

- **Run all commands from `frontend/`.** The Vitest config and `package.json` live there.
- **TDD discipline:** for each task, watch the test fail (Step 2) before implementing. Do not skip the failure check — it proves the test exercises the new code.
- **No live keys for unit tests.** Only Task 11 Step 2 touches the network; everything else is deterministic.
- **Follow existing patterns:** service-role `db` is passed in and every query is scoped by `agent_id`/`user_id` (matches the repo's RLS-bypass-with-explicit-scoping convention).
- **Cost guard** is enforced by `LoopConfig` (`maxIterations`, `maxWallClockMs`, `stallLimit`). The integration smoke uses `--iters 3` to stay cheap.

## Known limitations (v1, intentional)

- **Crash resume is re-run-based.** Re-running `tune.ts` seals a *new* `eval_epoch` and a fresh baseline; the prior tree is preserved but not continued. True mid-run resume (reload the sealed evaluator + tree, reconstruct `best`/`lastResult`, continue) is deferred to delivery (B) — it maps cleanly onto the server route and is tracked in the defer spec. This is a deliberate deviation from ship-spec success criterion 4, which becomes a (B) goal.
- **Evaluator infra failures stop the loop.** An Anthropic/Supabase error inside `evaluate` propagates out of `runLoop`; committed state persists in the DB, so no data is lost, but there is no automatic backoff/retry for the evaluator in v1 (the mutator has bounded retries). Re-run to continue.
- **Executable guardrail-tool generation is deferred** (see the Scope note in the header).
