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
