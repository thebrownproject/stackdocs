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
