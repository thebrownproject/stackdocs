# StackDocs Autoresearch Loop — Design (Ship Spec)

**Status:** Draft v1.0
**Date:** 2026-05-29
**Companion:** `2026-05-29-stackdocs-autoresearch-loop-deferred.md` (post-MVP roadmap)
**One-line:** An autonomous, gold-document-driven optimization loop that tunes a per-agent config bundle against a *frozen* eval harness — keeping a change only when measured held-out accuracy improves and no guardrail (gate) regresses — turning non-deterministic extraction agents into measured, trustworthy ones.

---

## 1. Context & vision

StackDocs is **Intelligent Document Processing (IDP) as a service**: businesses have documents flowing in that must become structured output (insurance claims → database rows; builders' manual paper forms → JSON that renders a digital form). StackDocs sits in the middle as the *processor*. The differentiator over pasting a document into ChatGPT is that we ship a **tuned, measured, guardrailed agent** per customer/document-type rather than a fragile one-off prompt.

The problem this spec solves: **agents are hard to manage and have no guardrails because they are non-deterministic.** The fix is to *train against gold documents* — known input/output pairs — so that an agent's quality is a measured number and its behavior is constrained by guardrails before it ever touches production.

This design is the **engine that produces a tuned agent**: point it at a customer's gold documents, and it autonomously iterates — mutate the agent's config → run it against the gold set → keep the change only if the measured score improves → repeat — until the agent is reliable enough to trust.

### Delivery order (locked)

- **A first — internal build-tool.** The StackDocs team runs the loop to build each customer's tuned agent ("a custom setup we build"). Driven from a CLI.
- **B later — in-product self-serve.** The customer uploads gold docs in the dashboard and clicks "tune"; the loop runs as a background job. *(Specified in the companion defer spec.)*

**Design principle from this ordering:** the loop's core logic must be a **portable, server-runnable engine** — not welded to a dev terminal — so the same engine drives (A) from a CLI and later powers (B) as a background job.

---

## 2. Prior art we are deliberately copying

Two proven implementations define this pattern; we are cloning their *principles*, not their code.

### Karpathy `autoresearch` (karpathy/autoresearch, March 2026)
Three files: `prepare.py` (the **frozen** harness, never touched), `train.py` (the **one** artifact the agent mutates), `program.md` (human-written strategy). Loop: read state → make *one* change → commit → run with a fixed budget → measure *one* scalar → keep if better, `git reset` if worse → repeat. Load-bearing rules: **one mutable artifact, fixed budget, single metric, binary keep/discard.**

### `evo-hq/evo` (cloned into `references/evo/`)
Productizes the pattern for codebases: a `discover` phase (instrument the benchmark, set gates) then an `optimize` loop. From reading its source (`plugins/evo/src/evo/core.py`, `frontier_strategies.py`, and the `discover`/`optimize`/`subagent` skills), the principles we adopt:

1. **Experiment graph, not a list** — state is a tree of nodes (`parent`, `children`, `status`, `score`, `commit`, `gates`); branching beats pure linear hill-climbing.
2. **Benchmark → `{score}` contract** — the frozen benchmark emits one JSON object with a scalar `score` plus per-task scores.
3. **Gates** — named pass/fail checks, *inherited down the tree, run on every experiment*; **a change that improves the score but fails a gate is rejected.** This is the guardrail mechanism.
4. **Goodhart defense** — a held-out slice + a mandatory anti-gaming gate when a benchmark is built from scratch, plus an "eval-epoch bump" for when the test itself is found to be gameable.
5. **Keep/discard + stall** — keep if `candidate ≥ parent` *and* gates pass; stop after N stalled rounds.

**Deliberately NOT copied for v1** (see defer spec): parallel subagents, git-worktree isolation, the five frontier strategies, the live dashboard, the Claude-Code-as-orchestrator model. evo needs these because it edits arbitrary code in a repo; StackDocs' artifact is a small structured bundle in a DB row, so v1 is a **single-agent greedy hill-climb**, with the data model shaped so tree-search/parallelism can be layered on later without a rewrite.

---

## 3. The core mapping and the frozen/mutable boundary

| evo / Karpathy concept | StackDocs equivalent | Status in repo |
|---|---|---|
| `train.py` (mutable target) | **The config bundle** | exists (`agent_bundles`) |
| `prepare.py` (frozen harness) | **Gold docs + 5 scorers + held-out split** | exists (`lib/harness/`) |
| `program.md` (strategy) | **Tuning strategy doc** per agent | new |
| `{score}` | **Held-out overall accuracy** | exists (`scoring.ts`) |
| per-task scores | **Per-field accuracy** | exists |
| gates | **Per-field floors, review-rate ceiling, schema-valid, custom invariants** | new |
| experiment graph | **Bundle-version tree** | partial (`agent_bundles`/`eval_runs`) |

### The hard boundary (this is the whole method)

- **MUTABLE by the loop agent — the bundle:**
  - `rules` (the tuned system prompt / extraction rules)
  - few-shot exemplar **selection** (which gold samples, how many)
  - generated **guardrail tools / validators** (e.g. "total must equal sum of line items", "date must be ISO")
  - field-schema **extraction hints** (per-field type, required flag) — *not* wholesale schema restructuring (deferred)

- **FROZEN — the loop agent physically cannot write these:**
  - the **gold documents** and their **expected outputs** (ground truth)
  - the **scorers** and their thresholds
  - the **train/held-out split**

  These are configured **once** by the Phase-0 setup agent (human-in-loop) and then *sealed* for the run. The only way to change them is an explicit **eval-epoch bump**, which invalidates all prior scores.

**Why the boundary is absolute:** if the agent could edit the thing that scores it, the fastest way to "improve accuracy" is to weaken the test (loosen a threshold, rewrite the gold answer). The agent *will* find that exploit. The frozen evaluator is the integrity of the entire method.

---

## 4. Two-phase architecture

Mirrors evo's `discover` → `optimize`.

### Phase 0 — Setup (human-in-loop, runs once per tuning run)
1. **Infer schema** from the gold documents' expected outputs (`schema-infer.ts`, exists).
2. **Split** gold docs into train / held-out, seeded for reproducibility (`split.ts`, exists).
3. **Choose a scorer per field** (`exact` / `numeric` / `date` / `fuzzy` / `presence`) — inferred, human-confirmed.
4. **Define gates** — per-field floors, review-rate ceiling, schema-valid, custom invariants — human-confirmed.
5. **Write the strategy doc** (the `program.md` equivalent): what the agent does, what may change, how to read the score, known gaming risks.
6. **Run the baseline bundle** (no rules, default few-shot) over the held-out set → baseline score. This is the **root node** of the experiment tree.
7. **Seal the evaluator** (freeze gold/scorers/split/gates under an eval-epoch).

### Phase 1 — Optimize loop (autonomous, greedy hill-climb), repeat until stall or cap
1. **Read state** — current best committed bundle, its per-field scores, failure traces (which docs/fields missed), the "what-not-to-try" list (discarded hypotheses), and the strategy doc.
2. **Propose ONE mutation** (the mutator agent, via Anthropic SDK) — rewrite rules / swap few-shot / add a guardrail tool / adjust a schema hint — aimed at the worst gated field or the biggest failure cluster.
3. **Materialize** a candidate bundle (new version, `parent = best committed`).
4. **Run the benchmark** — a **fresh agent session** over the held-out gold docs, scored by the frozen scorers → overall + per-field accuracy.
5. **Check gates** — if any gate fails, **discard** the candidate even if overall accuracy improved. (The guardrail.)
6. **Keep/discard** — commit if `overall ≥ parent + ε` *and* all gates pass; else discard and append the hypothesis to "what-not-to-try."
7. **Stall / cap** — increment the stall counter on no improvement, reset on improvement; stop at `stall` consecutive no-improvement rounds, or when `max_iterations` / `max_spend` / `wall_clock` is hit.

On stop → **promote** the best committed bundle to `agents.active_bundle_version` and write `accuracy_summary` (reuses existing promotion logic in `orchestrator.ts`).

### Three load-bearing decisions
- **Fresh agent session per experiment** — each candidate is judged by a brand-new agent run over the gold docs, so a gain must be *real and repeatable*, not session luck.
- **Variance handling** — because the score is already a mean over *all* held-out docs × fields, single-doc noise averages out; a **min-improvement ε** prevents committing on noise. Multi-seed re-evaluation is deferred.
- **Anthropic-SDK-driven mutation, not Claude-Code-as-orchestrator** — the loop engine calls the Anthropic API directly to get the next mutation. This keeps a single portable engine that runs in a terminal for (A) *and* as a background job for (B). evo's "Claude Code is the orchestrator" model is terminal-only and would not survive into (B).

---

## 5. Data model (extends existing tables)

New migration: `supabase/migrations/017_autoresearch_loop.sql`.

### `agent_bundles` (the mutable artifact) — add columns
- `parent_version INT NULL` — the bundle this candidate forked from (NULL for baseline/root).
- `status TEXT` — one of `baseline` | `candidate` | `committed` | `discarded`.
- `score NUMERIC NULL` — held-out overall accuracy for this bundle.
- `hypothesis TEXT NULL` — one-line description of what this mutation tried.
- `eval_epoch INT NOT NULL DEFAULT 1` — ties the bundle to the sealed evaluator generation.

Existing columns `rules`, `few_shot_sample_ids`, `field_schema`, `calibration_map` are the mutable surface.

### `agent_evaluators` (NEW — the sealed frozen harness)
One row per tuning run (per eval-epoch):
- `id`, `agent_id`, `user_id`
- `eval_epoch INT`
- `scorer_per_field JSONB` — `{ "<field>": "exact|numeric|date|fuzzy|presence" }`
- `gates JSONB` — array of declarative gate specs (see §6)
- `split_seed INT`
- `train_sample_ids JSONB`, `held_out_sample_ids JSONB` — the frozen split
- `strategy_doc TEXT` — the `program.md` equivalent
- `sealed_at TIMESTAMPTZ`
- RLS: Clerk JWT isolation (`auth.jwt()->>'sub' = user_id`), matching every other table.

Once written, treated as read-only by the loop. An eval-epoch bump inserts a *new* row; it never mutates an existing one.

### `eval_runs` (per experiment) — reuse + add
- Reuse existing `overall_accuracy`, `per_field_scores`, `phase`, `bundle_version`.
- Add `gate_results JSONB` — `[{ name, kind, passed, observed, threshold }]`.

### Gates are declarative (evaluated in TS, not shell)
Unlike evo's exit-code gate model, StackDocs gates are typed records evaluated in `gates.ts`. Simpler, safer, and portable to a server with no shell. See §6.

---

## 6. Gates (the guardrails)

A gate is a declarative record checked against a `ScoreResult` after every experiment. v1 kinds:

```ts
type Gate =
  | { kind: 'field_floor'; field: string; min: number }       // per-field accuracy ≥ min
  | { kind: 'review_rate_ceiling'; max: number }              // fraction routed to review ≤ max
  | { kind: 'schema_valid' }                                  // every output conforms to field_schema
```

`checkGates(gates, score) → GateResult[]` is a **pure function**. Any failing gate rejects the candidate regardless of overall score. Default floors are seeded from the existing `lib/audit/verdict.ts` thresholds (Ready/Pilot), so gates start aligned with the product's existing notion of "good enough." Custom invariant gates (e.g. arithmetic relationships) are added as guardrail *tools* in the bundle and enforced via `schema_valid`-style post-checks; richer custom gate kinds are deferred.

---

## 7. Component structure & interfaces

All new code under `frontend/lib/harness/loop/`, on top of reused primitives (`scorers.ts`, `scoring.ts`, `schema-infer.ts`, `split.ts`, `agent/runtime.ts`, `agent/process.ts`).

| Module | Job | Key interface | Depends on |
|---|---|---|---|
| `loop/types.ts` | Shared types | `Bundle`, `SealedEvaluator`, `Gate`, `GateResult`, `ExperimentNode`, `MutationProposal`, `LoopEvent`, `LoopConfig` | — |
| `loop/gates.ts` | Declarative guardrails | `checkGates(gates, score) → GateResult[]` (pure) | scoring types |
| `loop/evaluator.ts` | The **frozen benchmark** | `evaluate(bundle, sealed) → { score, perField, gateResults, traces, passed }` | `agent/runtime`, `scorers`, `gates` |
| `loop/mutator.ts` | The **propose-one-mutation agent** | `proposeMutation(state) → { bundlePatch, hypothesis }` (calls Anthropic SDK) | Anthropic SDK |
| `loop/tree.ts` | The **experiment graph** | `bestCommitted()`, `compareScores()`, `commit()`, `discard()` | `queries` (DB) |
| `loop/engine.ts` | The **orchestrator loop** | `runLoop(config) → AsyncGenerator<LoopEvent>` | mutator, evaluator, tree |
| `loop/setup.ts` | **Phase-0** sealing | `setupEvaluator(agentId, opts) → SealedEvaluator` | schema-infer, split |

`tree.ts` mirrors evo's `core.py` graph helpers (`best_committed_node`, `compare_scores`, status transitions) but persists to `agent_bundles`/`eval_runs` rather than `.evo/graph.json`.

`mutator.ts` generalizes today's `proposeRules()` (`orchestrator.ts:106`): instead of proposing only rules text in one shot, it returns a **typed patch** to any mutable part of the bundle, one mutation per iteration.

### Entry points
- **(A) now** — `frontend/scripts/tune.ts`: a CLI that runs Phase-0 setup interactively (you confirm scorers/gates), then drives `runLoop` and prints progress + a final summary. Same shape as the existing `verify-pipeline.ts`, against live Supabase + Anthropic.
- **(B) later** — `app/api/agents/[id]/tune/route.ts`: an SSE route invoking the *identical* `runLoop` engine as a background job. Supersedes today's `train/route.ts`. *(Defer spec.)*

### Isolation win
`engine.ts`, `tree.ts`, and `gates.ts` are fully deterministic and **unit-testable with a fake evaluator + fake mutator** — keep/discard, stall, gate rejection, and tree transitions are testable **without spending an API call**. The only LLM-touching parts are `evaluator.ts` and `mutator.ts`, both behind clean swappable interfaces.

---

## 8. Error handling

- **Bad candidate vs. infra failure are different.** A low score or failed gate is a *normal discard* — log and continue. An infra failure (Anthropic 5xx/timeout, Supabase error) is retried with backoff (bounded `max_attempts`, default 3); if it persists, the loop **pauses** rather than recording a false regression.
- **Invalid mutation patches.** Validate the patch (field exists, rules parse) before applying; invalid → discard + log, never crash. Bounded retries.
- **Gaming / Goodhart.** The frozen held-out slice + per-field gates catch most reward-hacking. The **eval-epoch bump** is the manual escape hatch: bump epoch, fix the harness, re-baseline; prior scores invalidated.
- **Resume.** Loop state lives in the DB bundle-tree; each experiment is atomic (committed or discarded), so a crash mid-loop resumes from the last committed node with no special restore.
- **Cost guard.** Every iteration runs the agent over the whole held-out set. Hard caps: `max_iterations`, `max_spend`, `wall_clock` — whichever hits first, on top of `stall`.
- **Billing.** Tuning runs hit gold docs, not production; they **must not** count against the customer's `/api/extract` quota. Metered separately (or not at all during A).

---

## 9. Testing

- **Unit (no API)** — `engine` keep/discard/stall, `tree` transitions, `gates` logic, `setup` split — via a **fake evaluator** (scripted scores) and **fake mutator** (scripted patches). Bulk of coverage; runs in CI for free. Lands in `frontend/lib/harness/loop/__tests__/`.
- **Integration** — extend `scripts/verify-pipeline.ts`: 3–5 gold docs, 2–3 real iterations against live Supabase + Anthropic, assert a bundle is promoted and accuracy recorded.
- **Reused** — existing `scorers` / `calibration` / `split` / `schema-infer` tests stand as-is.

---

## 10. Observability

- A `LoopEvent` SSE stream (reuses the streaming pattern in today's `train/route.ts`): `experiment_started` → `scored { overall, perField }` → `gate_results` → `committed | discarded { hypothesis }` → `stalled` → `complete`. This *is* the "watch accuracy climb" demo and the audit trail.
- Each experiment persists an `eval_run` + per-doc predictions (exists) + `hypothesis` + `gate_results`, so "why was v7 discarded" drills down via the existing `failure-drilldown.tsx` component.
- The CLI prints the event stream + a final summary (best score, experiment count, winning diff), mirroring evo's optimize end-summary.

---

## 11. MVP scope (this is the implementation plan's scope)

**Ship:**
- Phase-0 setup (schema-infer + split + scorer-per-field + gates, confirmed via CLI) → seal.
- Phase-1 **single-agent greedy loop**: mutate (rules / few-shot / guardrail-tool / schema-hint) → fresh-session eval over held-out → gates → keep/discard with ε → stall/cap stop.
- Linear bundle tree (parent = best committed).
- Declarative gates: `field_floor`, `review_rate_ceiling`, `schema_valid`.
- `scripts/tune.ts` CLI for (A).
- Best-bundle promotion (reuses existing).
- Deterministic unit tests for engine/tree/gates + an integration script.
- Budget cap (`max_iterations` + `max_spend` + `wall_clock`).
- Migration `017_autoresearch_loop.sql`.

**Defer:** everything in the companion defer spec.

---

## 12. Success criteria

1. On a real gold set (e.g. the builder-forms case), the loop measurably improves held-out accuracy over the baseline bundle across a run, and the improvement is reproducible on a fresh session.
2. No committed bundle ever violates a gate.
3. The engine/tree/gates have deterministic unit tests that pass with zero API calls.
4. A tuning run is fully resumable after a crash.
5. The same `runLoop` engine is invocable from both a CLI (A) and — without modification to its core — a server route (B).

---

## 13. Open questions / risks

- **Cost at scale.** Full held-out evaluation every iteration is the dominant cost. v1 caps iterations; the defer spec proposes cheap-subset-first evaluation.
- **Mutation quality.** The value of the loop hinges on the mutator proposing *good* changes. The strategy doc + failure traces + what-not-to-try list are the levers; we may need to iterate on the mutator prompt itself (meta — but out of scope for v1).
- **Held-out size.** Too few gold docs → noisy held-out score → ε threshold matters more. Setup should warn when the held-out slice is below a minimum (e.g. < 5 docs).
