// The shared extraction agent. One agent definition; per-call behaviour comes
// entirely from the account's tuned bundle (rules + field schema + few-shot).
// Reads the document file directly (no OCR) via an AI SDK file message part.

import { anthropic } from "@ai-sdk/anthropic";
import { Output, ToolLoopAgent } from "ai";
import type { FieldSchema } from "../harness/types";
import { modelId, type ModelTier } from "./models";
import {
  describeSchema,
  minConfidence,
  predictionSchema,
  reshapePrediction,
} from "./schema-to-zod";

const BASE_INSTRUCTIONS = [
  "You are a precise document data-extraction agent.",
  "Read the attached document and extract the requested fields.",
  "Use the exact dot-path given for each field as its `path`.",
  "If a field is not present in the document, return null for its value.",
  "For each field, give a calibrated confidence in [0,1] reflecting how certain you are the value is correct.",
].join(" ");

export interface RunAgentInput {
  fieldSchema: FieldSchema;
  /** Tuned, account-specific extraction rules (the bundle's system prompt). */
  rules?: string | null;
  /** Worked examples (ground-truth outputs from similar docs) for few-shot guidance. */
  fewShot?: Array<Record<string, unknown>>;
  file: { data: Uint8Array | URL | string; mediaType: string };
  modelTier?: ModelTier;
  abortSignal?: AbortSignal;
}

export interface RunAgentResult {
  extractedFields: Record<string, unknown>;
  confidenceScores: Record<string, unknown>;
  minConfidence: number;
  usage?: unknown;
}

export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const instructions = input.rules
    ? `${BASE_INSTRUCTIONS}\n\nAccount-specific rules:\n${input.rules}`
    : BASE_INSTRUCTIONS;

  const agent = new ToolLoopAgent({
    model: anthropic(modelId(input.modelTier ?? "inference")),
    instructions,
    output: Output.object({ schema: predictionSchema }),
  });

  const text = [
    describeSchema(input.fieldSchema),
    input.fewShot && input.fewShot.length > 0
      ? `\nExample outputs from similar documents (for format/field guidance only):\n${input.fewShot
          .slice(0, 3)
          .map((ex, i) => `Example ${i + 1}: ${JSON.stringify(ex)}`)
          .join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const fileData = typeof input.file.data === "string" ? new URL(input.file.data) : input.file.data;

  const { output, usage } = await agent.generate({
    abortSignal: input.abortSignal,
    prompt: [
      {
        role: "user",
        content: [
          { type: "text", text },
          { type: "file", data: fileData, mediaType: input.file.mediaType },
        ],
      },
    ],
  });

  const { extractedFields, confidenceScores } = reshapePrediction(output);
  return {
    extractedFields,
    confidenceScores,
    minConfidence: minConfidence(confidenceScores),
    usage,
  };
}
