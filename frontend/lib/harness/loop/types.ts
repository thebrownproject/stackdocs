// Shared types for the autoresearch optimization loop.
import type { FieldSchema, FieldType, ScoreResult } from "../types";

export type BundleStatus = "baseline" | "candidate" | "committed" | "discarded";

/** The mutable artifact the loop optimizes. */
export interface Bundle {
  version: number;
  parentVersion: number | null;
  rules: string | null;
  fewShotSampleIds: string[];
  fieldSchema: FieldSchema;
  status: BundleStatus;
  score: number | null;
  hypothesis: string | null;
  evalEpoch: number;
}

/** Declarative guardrails. A failing gate rejects a candidate regardless of score. */
export type Gate =
  | { kind: "field_floor"; field: string; min: number }
  | { kind: "review_rate_ceiling"; max: number }
  | { kind: "schema_valid" };

export interface GateResult {
  gate: Gate;
  passed: boolean;
  observed: number | boolean;
}

/** One frozen gold document + its ground-truth output. */
export interface EvalSample {
  id: string;
  filePath: string;
  filename: string;
  mediaType: string;
  expectedOutput: Record<string, unknown>;
}

/** The sealed, frozen evaluator. Written once in Phase 0, read-only thereafter. */
export interface SealedEvaluator {
  agentId: string;
  userId: string;
  evalEpoch: number;
  fieldSchema: FieldSchema; // scorer per field is FieldSpec.type
  gates: Gate[];
  reviewThreshold: number;
  heldOut: EvalSample[];
  train: EvalSample[];
  strategyDoc: string;
}

export interface ExperimentResult {
  score: number; // held-out overall accuracy
  perField: ScoreResult["perField"];
  reviewRate: number;
  schemaValid: boolean;
  gateResults: GateResult[];
  passed: boolean; // all gates passed
}

export interface BundlePatch {
  rules?: string | null;
  fewShotSampleIds?: string[];
  schemaHints?: Array<{ field: string; type?: FieldType; required?: boolean }>;
}

export interface MutationProposal {
  patch: BundlePatch;
  hypothesis: string;
}

export type LoopEvent =
  | { type: "experiment_started"; version: number; hypothesis: string; parentVersion: number | null }
  | { type: "scored"; version: number; score: number; perField: ScoreResult["perField"] }
  | { type: "gate_results"; version: number; gateResults: GateResult[] }
  | { type: "committed"; version: number; score: number; hypothesis: string }
  | { type: "discarded"; version: number; reason: string; hypothesis: string }
  | { type: "stalled"; round: number }
  | { type: "complete"; bestVersion: number | null; bestScore: number | null; experiments: number };

export interface LoopConfig {
  stallLimit: number;
  maxIterations: number;
  maxWallClockMs: number;
  epsilon: number; // minimum score improvement required to commit
}

export interface LoopState {
  best: Bundle;
  sealed: SealedEvaluator;
  lastResult: ExperimentResult;
  whatNotToTry: string[];
}

/** Persistence boundary for the bundle-version tree. */
export interface TreeStore {
  insertCandidate(patch: BundlePatch, hypothesis: string, parent: Bundle): Promise<Bundle>;
  commit(version: number, score: number): Promise<void>;
  discard(version: number, reason: string): Promise<void>;
}

export interface LoopDeps {
  evaluator: (bundle: Bundle, sealed: SealedEvaluator) => Promise<ExperimentResult>;
  mutator: (state: LoopState) => Promise<MutationProposal>;
  tree: TreeStore;
  now: () => number;
}
