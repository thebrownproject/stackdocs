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
