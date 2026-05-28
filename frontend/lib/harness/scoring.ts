// Score a set of predictions against ground truth, per field and overall.

import { flatten } from "./flatten";
import { MISSING, score } from "./scorers";
import type { FieldScore, FieldSchema, ScoreResult } from "./types";

export interface SampleEval {
  sampleId: string;
  expected: Record<string, unknown>;
  actual: Record<string, unknown>;
}

export interface RunScore {
  result: ScoreResult;
  /** sampleId -> (fieldName -> passed) for prediction-level drilldown. */
  perSample: Record<string, Record<string, boolean>>;
}

export function scoreRun(schema: FieldSchema, evals: SampleEval[]): RunScore {
  const perField: Record<string, FieldScore> = {};
  for (const f of schema) {
    perField[f.name] = { passed: 0, total: 0, accuracy: 0, scorer: f.type };
  }

  const perSample: Record<string, Record<string, boolean>> = {};
  let cellsPassed = 0;
  let cellsTotal = 0;

  for (const ev of evals) {
    const expected = flatten(ev.expected ?? {});
    const actual = flatten(ev.actual ?? {});
    const fieldResults: Record<string, boolean> = {};

    for (const f of schema) {
      const e = f.name in expected ? expected[f.name] : MISSING;
      const a = f.name in actual ? actual[f.name] : MISSING;
      const passed = score(f.type, e, a);
      fieldResults[f.name] = passed;
      perField[f.name].total += 1;
      cellsTotal += 1;
      if (passed) {
        perField[f.name].passed += 1;
        cellsPassed += 1;
      }
    }
    perSample[ev.sampleId] = fieldResults;
  }

  for (const name of Object.keys(perField)) {
    const fs = perField[name];
    fs.accuracy = fs.total === 0 ? 0 : fs.passed / fs.total;
  }

  return {
    result: {
      overallAccuracy: cellsTotal === 0 ? 0 : cellsPassed / cellsTotal,
      perField,
    },
    perSample,
  };
}
