// Build the structured-output schema for the agent, and reshape its output into
// the two parallel JSONB blobs the rest of the app expects (extracted_fields +
// confidence_scores). Confidence is not a native model feature, so we ask for it
// explicitly per field as `{ path, value, confidence }`.

import { z } from "zod";
import { flatten, setPath } from "../harness/flatten";
import type { FieldSchema } from "../harness/types";

const fieldValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

/** A flat list of predicted fields keyed by dot-path, each with a confidence. */
export const predictionSchema = z.object({
  fields: z.array(
    z.object({
      path: z.string().describe("Dot-path of the field, e.g. 'vendor.name'"),
      value: fieldValue.describe("Extracted value, or null if not present in the document"),
      confidence: z.number().min(0).max(1).describe("How confident you are this value is correct (0-1)"),
    }),
  ),
});

export type Prediction = z.infer<typeof predictionSchema>;

/** Render the expected field list into prompt guidance. */
export function describeSchema(schema: FieldSchema): string {
  if (schema.length === 0) return "Extract all relevant fields you can find.";
  const lines = schema.map((f) => {
    const req = f.required ? " (required)" : "";
    const desc = f.description ? ` — ${f.description}` : "";
    return `- ${f.name} [${f.type}]${req}${desc}`;
  });
  return `Extract these fields (use the exact dot-path as 'path'):\n${lines.join("\n")}`;
}

/** Split the model's flat field list into nested extracted_fields + confidence_scores. */
export function reshapePrediction(prediction: Prediction): {
  extractedFields: Record<string, unknown>;
  confidenceScores: Record<string, unknown>;
} {
  const extractedFields: Record<string, unknown> = {};
  const confidenceScores: Record<string, unknown> = {};
  for (const f of prediction.fields ?? []) {
    if (!f.path) continue;
    setPath(extractedFields, f.path, f.value);
    setPath(confidenceScores, f.path, f.confidence);
  }
  return { extractedFields, confidenceScores };
}

/** Lowest confidence across all predicted fields (for review-queue routing). */
export function minConfidence(confidenceScores: Record<string, unknown>): number {
  const flat = flatten(confidenceScores);
  const vals = Object.values(flat).filter((v): v is number => typeof v === "number");
  return vals.length === 0 ? 0 : Math.min(...vals);
}
