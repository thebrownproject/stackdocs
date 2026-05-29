# Related Work & Positioning: GEPA, SkillOpt, and our loop

**Status:** Reference note, 2026-05-29
**Companion:** `2026-05-29-stackdocs-autoresearch-loop-design.md` (ship spec) and
`...-deferred.md` (defer spec). Read those first for our loop's design.

## Why this doc exists

Two external projects do something close to our autoresearch loop:

- **GEPA** (`github.com/gepa-ai/gepa`) , academic, DSPy-ecosystem, Pareto-heavy
  reflective prompt evolution.
- **Microsoft SkillOpt** (`github.com/microsoft/SkillOpt`) , trajectory-driven,
  validation-gated optimization of natural-language "skill" documents.

This note records (1) how they compare to us, (2) the strategic read, (3) the
architectural decision about whether to depend on them, and (4) concrete,
prioritised improvements to our loop that they suggest.

## The shared idea

All three are instances of the same bet, an active research category with no settled
name yet, roughly: **text-space / reflective optimization of a frozen agent's
instructions against a measured evaluator** (instead of gradient descent / RL /
fine-tuning). When an academic line (GEPA) and Microsoft Research (SkillOpt)
independently converge on the architecture we built, that is validation that the bet
is sound, not a threat.

## Side-by-side

| Concept | GEPA | SkillOpt | Our loop |
|---|---|---|---|
| Optimizes | any text artifact (prompts, code, configs) | a skill document (markdown) | the config **bundle** (rules + few-shot + schema-hints) |
| Method | Select (Pareto) -> Execute -> Reflect -> Mutate -> Accept | trajectory-driven edits, validation-gated updates | mutate -> evaluate -> keep/discard (greedy) |
| Mutation signal | full execution traces ("Actionable Side Information") | agent trajectories | per-field scores + a sample of failures |
| Selection | **Pareto frontier** (candidates specialised per task subset) | best validated version | **greedy** single best parent |
| Split | train / (Pareto val) / test | **train / val / test** | **train / held-out** (two-way) |
| Versioning | candidate pool | `skill_vXXXX.md` -> `best_skill.md` | `agent_bundles` version tree -> `active_bundle_version` |
| Stance | "35x faster than RL" | "avoids fine-tuning and simple prompt tweaking" | Karpathy/evo-style, anti-RL/anti-one-shot |
| Language/stack | Python (DSPy) | Python | **TypeScript, in-process Next.js** |

## Strategic read

1. **We are not behind, and not redundant.** GEPA and SkillOpt are *optimizer
   libraries / research*. We are a *vertically integrated product*: automatic schema
   inference, the frozen/sealed evaluator boundary, declarative guardrail gates,
   confidence calibration, the Postgres bundle-version tree, audit-link generation,
   and production delivery/routing. The optimizer is roughly 15% of the product; the
   moat is the other 85%. Neither project turns a customer's labelled documents into
   a deployed, billed, measured extraction agent.

2. **Both are Python; we are single-stack TypeScript.** Our architecture principle is
   "no separate backend, all inference in Next.js route handlers"
   (`frontend/CLAUDE.md`). Taking a dependency on GEPA (DSPy) or SkillOpt would mean a
   Python service or a port, a heavy cost for a solo founder, and it would break the
   single-stack property that keeps the engine portable from CLI (delivery A) to
   server route (delivery B).

## Decision: borrow ideas, do not take the dependency

**We keep our own TypeScript engine (`engine.ts` / `tree.ts` / `evaluator.ts` /
`mutator.ts`) and port specific *concepts* from GEPA and SkillOpt natively.** This
preserves the frozen-evaluator boundary, the portable-engine principle, and the
single-stack architecture, while still capturing the proven ideas. Revisit only if we
ever need an optimizer far beyond what we want to maintain ourselves.

## Concrete improvements to our loop (prioritised)

Ordered by value-for-effort. **Nothing here should jump ahead of the still-open #1
task: prove the current greedy loop produces a real accuracy gain on a real gold set
(ship-spec live integration smoke). The sophistication below only pays off after
that.**

### 1. Train / val / test three-way split (from SkillOpt) , highest value

**Today:** we split train / held-out (two-way). The loop both *tunes against* and
*is scored on* the same held-out set, so the final number can drift upward by fitting
the held-out set itself (a subtle Goodhart leak).

**Change:** split three ways. Use **val** for the keep/discard gate decision during
the loop; hold **test** back, shown to the loop never, used only to report the honest
final number. If val climbs while test does not, that is overfitting, surfaced
directly.

**Why it is the best first upgrade:** it is small (touches `split.ts`, `setup.ts`,
`evaluator.ts` wiring), and it directly strengthens our core sales claim , a measured
accuracy you can *trust*. This generalises and partly absorbs defer item **D7**
(shadow held-out slice). Needs >= ~6 to 8 labelled samples to be meaningful, so keep
two-way as a fallback for tiny sets.

### 2. Richer reflective feedback to the mutator (from GEPA's "ASI")

**Today:** `mutator.ts` gets per-field accuracy plus a sample of failures.

**Change:** feed the mutator more diagnostic signal per round , concrete
expected-vs-got examples for the worst field, which gate failed and by how much, and
tool-call traces where available. GEPA's core insight is that preserving diagnostic
detail (not collapsing to a scalar) is what makes reflective mutation work. This is a
prompt-construction change in `mutator.ts`, no architecture change.

### 3. Per-field Pareto selection (from GEPA) , this is our existing D3

GEPA confirms the value of our deferred **D3**: keep multiple committed candidates
that each excel at *different fields* and select which to branch from via a Pareto
strategy, rather than always branching from the single best aggregate. Especially apt
for IDP, where one bundle nails dates and another nails totals. Already specced in the
defer spec; GEPA is the reference implementation to port from. Keep it after #1 and #2
because it is a larger change to `tree.ts`.

### 4. System-aware merge (from GEPA) , later

GEPA can merge two Pareto-optimal candidates into one combining their strengths. Only
meaningful once #3 (a real frontier) exists. Park beyond D3.

## Defer-spec deltas this note implies

- **New item (call it D11): train/val/test split**, credited to SkillOpt; see #1
  above. Sequence it *early* (with or just after the live-smoke validation), ahead of
  D3, because it is cheap and trust-critical.
- **Sharpen D3** with GEPA's vocabulary: Pareto frontier, candidate specialised per
  task subset, system-aware merge as a follow-on.
- **Note against D7**: the val/test split (D11) is the simpler first step toward the
  overfitting detection D7 describes.
