import { describe, expect, it } from "vitest";
import { toPredictionRows } from "../persist";
import type { ExperimentSampleDetail } from "../types";

const details: ExperimentSampleDetail[] = [
  {
    sampleId: "s1",
    extractedFields: { vendor: "Acme", total: 100 },
    confidenceScores: { vendor: 0.9, total: 0.95 },
    perFieldPassed: { vendor: true, total: true },
  },
  {
    sampleId: "s2",
    extractedFields: { vendor: "Globex", total: 200 },
    confidenceScores: { vendor: 0.8, total: 0.4 },
    perFieldPassed: { vendor: true, total: false },
  },
];

describe("toPredictionRows", () => {
  it("maps each detail to a prediction row shaped for the audit query", () => {
    const rows = toPredictionRows(details, "user-1");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      sample_id: "s1",
      user_id: "user-1",
      output: { vendor: "Acme", total: 100 },
      confidence_scores: { vendor: 0.9, total: 0.95 },
      per_field_passed: { vendor: true, total: true },
    });
  });

  it("stamps every row with the given user id", () => {
    const rows = toPredictionRows(details, "user-x");
    expect(rows.every((r) => r.user_id === "user-x")).toBe(true);
  });

  it("returns an empty array for no details", () => {
    expect(toPredictionRows([], "user-1")).toEqual([]);
  });
});
