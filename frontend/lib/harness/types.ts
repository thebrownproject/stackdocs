// Shared types for the eval harness.

/** How a field's predicted value is compared against ground truth. */
export type FieldType = "exact" | "numeric" | "date" | "fuzzy" | "presence";

/** One field in an agent's inferred schema. `name` is a dot-path (e.g. "vendor.name"). */
export interface FieldSpec {
  name: string;
  type: FieldType;
  description?: string;
  required: boolean;
}

export type FieldSchema = FieldSpec[];

/** A single labelled example: the document plus its ground-truth output. */
export interface Sample {
  id: string;
  expectedOutput: Record<string, unknown>;
  split?: "train" | "test";
}

/** The agent's prediction for one sample, flattened to leaf dot-paths. */
export type FlatRecord = Record<string, unknown>;

/** Per-field score across a set of samples. */
export interface FieldScore {
  passed: number;
  total: number;
  accuracy: number;
  scorer: FieldType;
}

export interface ScoreResult {
  overallAccuracy: number;
  perField: Record<string, FieldScore>;
}
