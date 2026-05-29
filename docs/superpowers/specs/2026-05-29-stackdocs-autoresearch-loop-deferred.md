# StackDocs Autoresearch Loop — Deferred Roadmap (Defer Spec)

**Status:** Draft v1.0
**Date:** 2026-05-29
**Companion:** `2026-05-29-stackdocs-autoresearch-loop-design.md` (ship spec — read first)
**Purpose:** Capture everything intentionally cut from the MVP, with enough detail that each item can become its own spec → plan → implementation cycle later. Ordered roughly by recommended sequence. Nothing here should be built until the ship spec's MVP is working and has produced a real accuracy gain on a real gold set.

---

## D0. Guiding rule

Every deferred item must preserve the **frozen-evaluator boundary** (ship spec §3) and the **portable-engine principle** (ship spec §1): the same `runLoop` core serves the CLI (A) and the server (B). Nothing below may move loop logic into a dev-terminal-only host.

---

## D1. (B) In-product self-serve productization — *highest priority post-MVP*

**Goal:** the customer uploads gold docs in the dashboard and clicks "tune"; the loop runs as a background job, no engineer in the loop.

**Scope:**
- `app/api/agents/[id]/tune/route.ts` — SSE route invoking the *unchanged* `runLoop` engine. Raise `maxDuration`; cap sample/iteration counts (the architecture already anticipates a single SSE route — see `TRESTLE-ARCHITECTURE.md` §2).
- Background-job consideration: Vercel function timeouts cap a single SSE run. Decide between (a) a long-`maxDuration` route for small runs, or (b) a queue (Inngest / Supabase queue) for larger runs — add the queue **only when batch volume demands it** (per existing architecture guidance), not pre-emptively.
- **Phase-0 setup UI** — a wizard that replaces the CLI's interactive confirmation: schema review, scorer-per-field selection, gate/threshold sliders (reuse `audit/review-rate-slider.tsx`), strategy-doc editor.
- **Live tuning UI** — render the `LoopEvent` stream as a climbing-accuracy chart + experiment tree; reuse `failure-drilldown.tsx` for per-experiment drilldown.
- **Billing** — meter tuning separately from extraction quota (ship spec §8); define a tuning price/credit model (per-iteration or per-run). Hook into existing `lib/billing/enforce.ts`.
- **Concurrency / cost controls** — per-account caps on concurrent tuning runs and spend ceilings, enforced server-side.

**Dependencies:** ship-spec MVP complete; the engine must already be proven portable (success criterion 5).

---

## D2. Cheap-subset-first evaluation — *cost reduction, do early*

**Problem:** full held-out evaluation every iteration is the dominant cost (ship spec §13).

**Design:** mirror evo's `--check` idea. Evaluate a candidate first on a cheap subset (e.g. 3–5 held-out docs). Only candidates that clear a provisional bar get the *full* held-out evaluation that decides commit. Keep the **commit decision always on the full frozen held-out set** — the subset is a pre-filter only, never the thing that promotes a bundle (or it becomes a second, weaker evaluator and erodes the boundary).

**Risk:** a subset pre-filter can discard a candidate that would have won on the full set. Acceptable for cost; document it and make the subset size configurable.

---

## D3. Per-field Pareto frontier (tree search) — *first "intelligence" upgrade*

**Why it fits IDP especially well:** different bundles are best at different *fields* (one nails dates, another nails totals). evo's `pareto_per_task` (GEPA-inspired, in `frontier_strategies.py`) preserves these specialists instead of letting an aggregate score hide them — and per-field accuracy is exactly StackDocs' "per-task" signal.

**Scope:**
- Generalize `tree.ts` from "parent = best committed" to a real frontier: `frontierNodes()` + a strategy registry (`argmax`, `top_k`, `epsilon_greedy`, `softmax`, `pareto_per_task`), porting the algorithms in `references/evo/plugins/evo/src/evo/frontier_strategies.py`.
- Emit `tasks_meta` (per-field direction) from the evaluator so Pareto honors per-field max/min.
- The loop selects which committed node to branch from each round via the configured strategy.

**Prereq:** the bundle tree already stores `parent_version` (ship spec §5), so this is additive — no migration churn.

**External reference:** GEPA (`github.com/gepa-ai/gepa`) is the canonical implementation of this Pareto-frontier idea (candidates specialised per task subset; "system-aware merge" of two Pareto-optimal candidates is a later follow-on). See `2026-05-29-related-work-gepa-skillopt.md` for the full comparison. Port the concept natively in TS — do not take the (Python/DSPy) dependency.

---

## D11. Train / val / test three-way split — *cheap, trust-critical; do early*

**Source:** Microsoft SkillOpt (`github.com/microsoft/SkillOpt`), which trains against a `val` split and holds `test` back. See `2026-05-29-related-work-gepa-skillopt.md`.

**Problem:** the MVP splits train / held-out only. The loop both tunes against and is scored on the same held-out set, so the reported number can drift upward by fitting the held-out set itself — a subtle Goodhart leak that undercuts our core "measured accuracy you can trust" claim.

**Design:** split three ways. Use **val** for the per-round keep/discard gate decision; hold **test** back, shown to the loop never, used only for the final reported number. Divergence (val climbs, test flat) directly signals overfitting. Touches `split.ts`, `setup.ts`, and evaluator wiring; keep two-way as a fallback for tiny sample sets (< ~6–8). Generalises and partly absorbs **D7**. **Sequence this early** — with or just after the ship-spec live-smoke validation, ahead of D3.

---

## D4. Parallel subagents + workspace isolation

**Why:** more experiments per wall-clock; diverse hypotheses per round (evo's `optimize` model — orchestrator writes N non-overlapping briefs, subagents run in parallel).

**Scope:**
- An orchestrator layer above `engine.ts` that, each round, analyzes cross-cutting failure patterns and writes N briefs (objective / parent / boundaries / pointer-traces), then runs N mutation+eval branches concurrently.
- **Isolation:** unlike evo (git worktrees for code), StackDocs candidates are DB rows — isolation is just distinct `candidate` bundle versions; no filesystem worktrees needed. This is *simpler* for us than for evo.
- Concurrency cap + cost guard scale with parallelism.
- "What-not-to-try" and annotations become cross-agent shared state (already in the data model as discarded-hypothesis records).

**Caution:** only worth it once single-agent greedy is proven and cost controls exist. Parallelism multiplies spend.

---

## D5. Multi-seed variance handling

**Problem:** LLM extraction is non-deterministic; a single fresh-session score can be noisy, so a marginal commit may be luck.

**Design:** evaluate a candidate over K fresh seeds and use mean (and optionally variance) for the keep/discard decision; require the *lower bound* (mean − k·stderr) to beat parent for high-stakes gates. Make K configurable; default K=1 (MVP behavior). Record per-seed scores for audit.

**Interaction with D2:** combine — cheap subset for pre-filter, multi-seed full eval for the commit decision on promising candidates.

---

## D6. Schema-restructuring as a mutable surface

**MVP limit:** the mutator may adjust *schema hints* (per-field type, required flag) but not restructure the schema (add/remove/rename/nest fields).

**Deferred:** allow the mutator to propose schema-structure changes when it detects the inferred schema is wrong (e.g. a field that should be split, or a repeating line-item array mis-modeled). This is powerful but dangerous — a schema change alters what the scorers compare against, so it must trigger a **controlled eval-epoch bump** (re-baseline), never a silent in-run mutation. Specify the human-approval gate for schema changes.

---

## D7. Automatic eval-epoch tooling

**MVP:** eval-epoch bumps are manual (an engineer decides the evaluator is gameable/wrong, bumps, re-baselines).

**Deferred:** detection + tooling — flag suspected gaming (e.g. held-out climbs while a held-back "shadow" slice does not), surface it, and provide a one-command epoch bump + re-baseline flow. Optionally maintain a permanent *shadow* held-out slice never shown to the loop, purely to detect overfitting to the held-out set itself.

> **Note:** the train/val/test split (**D11**) is the simpler first step toward this — once `test` is held back from the loop, val-vs-test divergence already gives a basic overfitting signal without the full epoch-bump tooling.

---

## D8. Live dashboard (evo-style)

**MVP:** CLI prints the event stream + final summary.

**Deferred:** a real-time dashboard (evo auto-launches one on port 8080+) showing the experiment tree, frontier, per-field accuracy over time, and gate status. Largely overlaps with D1's in-product live tuning UI — build once, for (B), rather than a separate dev dashboard.

---

## D9. Drift detection & corrections flywheel (production loop)

**Beyond tuning:** in production, low-confidence extractions route to the review queue; human corrections become new labelled samples (already in the Trestle data model). Deferred work: feed those corrections back as *new gold docs*, detect accuracy drift over time, and auto-propose a re-tuning run when drift crosses a threshold. This closes the loop from production back into the harness — the long-term moat, but explicitly out of scope until tuning itself is solid.

---

## D10. Richer custom gate kinds

**MVP:** gates are `field_floor`, `review_rate_ceiling`, `schema_valid`; arithmetic/relational invariants are enforced via guardrail *tools* + `schema_valid` post-checks.

**Deferred:** first-class declarative gate kinds for cross-field invariants (`sum_equals`, `date_order`, `enum_membership`, regex), evaluated in `gates.ts`, so customers can express domain rules without a custom tool. Keep them declarative and TS-evaluated (never shell) to preserve server portability.

---

## Sequencing recommendation

0. **(Not deferred) Prove the greedy loop live** — ship-spec integration smoke must show a real gain on a real gold set before any item below is worth building.
1. **D11** (train/val/test split) — cheap, trust-critical; do with/just after the live-smoke validation.
2. **D2** (cost) + **D1** (productize B) — make it cheap and self-serve.
3. **D3** (Pareto tree search) — the first real quality jump.
4. **D5** (multi-seed) + **D10** (gate kinds) — robustness.
5. **D4** (parallel subagents) — throughput, once cost is controlled.
6. **D6** (schema mutation) + **D7** (epoch tooling) — power-user/safety.
7. **D8** (dashboard, folded into D1) + **D9** (drift flywheel) — long-term moat.
