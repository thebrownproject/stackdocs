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
