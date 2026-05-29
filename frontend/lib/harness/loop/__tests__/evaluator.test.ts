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
