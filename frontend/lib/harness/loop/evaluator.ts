// The frozen benchmark: run the tuned bundle over the held-out gold docs with a
// FRESH agent session per doc, score with the frozen scorers, and check gates.
import { scoreRun, type SampleEval } from "../scoring";
import { flatten } from "../flatten";
import { runAgent } from "../../agent/runtime";
import { getAgentTools } from "../../agent/tools/registry";
import { downloadFileBytes } from "../../supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkGates, allGatesPassed } from "./gates";
import type { Bundle, EvalSample, ExperimentResult, SealedEvaluator } from "./types";

interface RunOneResult {
  extractedFields: Record<string, unknown>;
  confidenceScores: Record<string, unknown>;
  minConfidence: number;
}

export interface EvaluatorDeps {
  /** Run the agent over one held-out doc. Injected so the loop is unit-testable. */
  runOne: (sample: EvalSample, bundle: Bundle, sealed: SealedEvaluator) => Promise<RunOneResult>;
}

/** True when every required field is present (non-missing) in the output. */
function isSchemaValid(sealed: SealedEvaluator, actual: Record<string, unknown>): boolean {
  const flat = flatten(actual ?? {});
  return sealed.fieldSchema
    .filter((f) => f.required)
    .every((f) => f.name in flat && flat[f.name] !== null && flat[f.name] !== "");
}

export async function evaluate(
  bundle: Bundle,
  sealed: SealedEvaluator,
  deps: EvaluatorDeps,
): Promise<ExperimentResult> {
  const evals: SampleEval[] = [];
  let reviewCount = 0;
  let schemaValid = true;

  for (const sample of sealed.heldOut) {
    const out = await deps.runOne(sample, bundle, sealed);
    evals.push({ sampleId: sample.id, expected: sample.expectedOutput, actual: out.extractedFields });
    if (out.minConfidence < sealed.reviewThreshold) reviewCount += 1;
    if (!isSchemaValid(sealed, out.extractedFields)) schemaValid = false;
  }

  const { result } = scoreRun(sealed.fieldSchema, evals);
  const reviewRate = sealed.heldOut.length === 0 ? 0 : reviewCount / sealed.heldOut.length;
  const gateResults = checkGates(sealed.gates, { score: result, reviewRate, schemaValid });

  return {
    score: result.overallAccuracy,
    perField: result.perField,
    reviewRate,
    schemaValid,
    gateResults,
    passed: allGatesPassed(gateResults),
  };
}

/** Production `runOne`: downloads the doc and runs a fresh agent session. */
export function makeLiveRunOne(db: SupabaseClient, agentId: string): EvaluatorDeps["runOne"] {
  const tools = getAgentTools(agentId);
  return async (sample, bundle, sealed) => {
    const bytes = await downloadFileBytes(db, sample.filePath);
    // Resolve the bundle's few-shot ids into example outputs. Exemplars are drawn
    // ONLY from the sealed train split (never the held-out set), so few-shot
    // selection cannot leak the held-out answers it is being scored against.
    const trainById = new Map(sealed.train.map((s) => [s.id, s.expectedOutput]));
    const fewShot = bundle.fewShotSampleIds
      .map((id) => trainById.get(id))
      .filter((ex): ex is Record<string, unknown> => ex !== undefined);
    const res = await runAgent({
      fieldSchema: bundle.fieldSchema,
      rules: bundle.rules,
      fewShot,
      file: { data: bytes, mediaType: sample.mediaType },
      filename: sample.filename,
      tools,
    });
    return {
      extractedFields: res.extractedFields,
      confidenceScores: res.confidenceScores,
      minConfidence: res.minConfidence,
    };
  };
}
