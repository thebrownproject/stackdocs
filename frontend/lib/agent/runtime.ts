// The shared extraction agent. One agent definition; per-call behaviour comes
// entirely from the account's tuned bundle (rules + field schema + few-shot).
// Reads the document file directly (no OCR) via an AI SDK file message part.
//
// This is a real agent, not a single shot: extended thinking is enabled and the
// model runs a multi-step tool loop (verify totals, normalise dates, plus any
// account-specific tools wired in per engagement) BEFORE emitting the final
// structured output.

import { anthropic } from "@ai-sdk/anthropic";
import { Output, ToolLoopAgent, stepCountIs, tool, type ToolSet } from "ai";
import { z } from "zod";
import type { FieldSchema } from "../harness/types";
import { normalizeToModelInput } from "./ingest";
import { modelId, type ModelTier } from "./models";
import {
  describeSchema,
  minConfidence,
  predictionSchema,
  reshapePrediction,
} from "./schema-to-zod";

const MAX_STEPS = 8; // how many reason→tool rounds before the agent must answer
const THINKING_BUDGET = 6000; // extended-thinking token budget per call

const BASE_INSTRUCTIONS = [
  "You are a precise document data-extraction agent.",
  "Read the attached document and extract the requested fields.",
  "Use the exact dot-path given for each field as its `path`.",
  "If a field is not present in the document, return null for its value.",
  "Think step by step. Before finalizing, use the available tools to verify any computed or",
  "formatted values — e.g. check that line items sum to the stated total with `calculate`, and",
  "normalise/validate dates with `validate_date`. Only after verifying should you produce the output.",
  "For each field, give a calibrated confidence in [0,1] reflecting how certain you are the value is correct.",
].join(" ");

// Deterministic, dependency-free tools the agent can call to check its work.
// Account-specific tools (lookups, validations against the customer's data) are
// merged in per engagement via RunAgentInput.tools.
const builtinTools: ToolSet = {
  calculate: tool({
    description:
      "Perform arithmetic to verify totals or line items before finalizing values. Returns the rounded result.",
    inputSchema: z.object({
      operation: z.enum(["sum", "subtract", "multiply", "divide"]),
      values: z.array(z.number()).min(1),
    }),
    execute: async ({ operation, values }) => {
      let result: number;
      switch (operation) {
        case "sum":
          result = values.reduce((a, b) => a + b, 0);
          break;
        case "subtract":
          result = values.reduce((a, b) => a - b);
          break;
        case "multiply":
          result = values.reduce((a, b) => a * b, 1);
          break;
        case "divide":
          result = values.reduce((a, b) => a / b);
          break;
      }
      return { result: Math.round(result * 100) / 100 };
    },
  }),
  validate_date: tool({
    description: "Normalise a date string to ISO (YYYY-MM-DD) and report whether it is a valid date.",
    inputSchema: z.object({ value: z.string() }),
    execute: async ({ value }) => {
      const d = new Date(value);
      const valid = !Number.isNaN(d.getTime());
      return { valid, iso: valid ? d.toISOString().slice(0, 10) : null };
    },
  }),
};

export interface RunAgentInput {
  fieldSchema: FieldSchema;
  /** Tuned, account-specific extraction rules (the bundle's system prompt). */
  rules?: string | null;
  /** Worked examples (ground-truth outputs from similar docs) for few-shot guidance. */
  fewShot?: Array<Record<string, unknown>>;
  file: { data: Uint8Array | URL | string; mediaType: string };
  /** Original filename, used to detect convertible formats (docx/xlsx/csv). */
  filename?: string;
  /** Account-specific tools (lookups/validations) merged with the built-ins. */
  tools?: ToolSet;
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
    tools: { ...builtinTools, ...(input.tools ?? {}) },
    stopWhen: stepCountIs(MAX_STEPS),
    output: Output.object({ schema: predictionSchema }),
    providerOptions: {
      anthropic: { thinking: { type: "enabled", budgetTokens: THINKING_BUDGET } },
    },
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

  // Convert non-native formats (docx/xlsx/csv/...) to text; pass PDFs/images directly.
  const doc = await normalizeToModelInput(input.file.data, input.file.mediaType, input.filename);
  const documentPart =
    doc.kind === "text"
      ? { type: "text" as const, text: `Document content:\n\n${doc.text}` }
      : {
          type: "file" as const,
          data: typeof doc.data === "string" ? new URL(doc.data) : doc.data,
          mediaType: doc.mediaType,
        };

  const { output, usage } = await agent.generate({
    abortSignal: input.abortSignal,
    prompt: [
      {
        role: "user",
        content: [{ type: "text", text }, documentPart],
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
