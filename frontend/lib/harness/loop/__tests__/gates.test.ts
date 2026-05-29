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
