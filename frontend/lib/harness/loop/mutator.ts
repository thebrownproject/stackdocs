// The mutator: a strong model reads the current best bundle, its per-field
// scores, and what-not-to-try, and proposes ONE typed patch to the bundle.
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { modelId } from "../../agent/models";
import type { LoopState, MutationProposal } from "./types";

const PATCH_KEYS = ["rules", "fewShotSampleIds", "schemaHints"] as const;

/** Strict parse + validate of the model's JSON proposal. Returns null if invalid. */
export function parseProposal(text: string): MutationProposal | null {
  const match = text.trim().match(/\{[\s\S]*\}/);
  if (!match) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  const hypothesis = typeof obj.hypothesis === "string" ? obj.hypothesis : null;
  const patch = typeof obj.patch === "object" && obj.patch !== null ? (obj.patch as Record<string, unknown>) : null;
  if (!hypothesis || !patch) return null;
  const hasKnownKey = PATCH_KEYS.some((k) => k in patch);
  if (!hasKnownKey) return null;
  return { patch: patch as MutationProposal["patch"], hypothesis };
}

export interface MutatorDeps {
  /** Returns the model's raw text. Injected so the loop is unit-testable. */
  generate: (prompt: string) => Promise<string>;
}

function buildPrompt(state: LoopState): string {
  const fields = Object.entries(state.lastResult.perField)
    .map(([name, s]) => `  - ${name} (${s.scorer}): ${(s.accuracy * 100).toFixed(0)}%`)
    .sort()
    .join("\n");
  const avoid = state.whatNotToTry.length
    ? `\nApproaches already tried and discarded (do NOT repeat):\n${state.whatNotToTry.map((h) => `  - ${h}`).join("\n")}`
    : "";
  // Few-shot exemplars may only be chosen from the train split (held-out ids are
  // never valid). Surface the available ids so "fewShotSampleIds" is a usable lever.
  const available = state.sealed.train.slice(0, 12).map((s) => s.id);
  const currentFewShot = state.best.fewShotSampleIds.length
    ? state.best.fewShotSampleIds.join(", ")
    : "(none)";
  const fewShotInfo = available.length
    ? `\nAvailable few-shot sample ids (train split only): ${available.join(", ")}\nCurrently used as few-shot: ${currentFewShot}`
    : "";
  return [
    `You are tuning a document-extraction agent. Goal: raise held-out accuracy.`,
    state.sealed.strategyDoc ? `\nStrategy:\n${state.sealed.strategyDoc}` : "",
    `\nCurrent overall accuracy: ${(state.lastResult.score * 100).toFixed(1)}%`,
    `Per-field accuracy:\n${fields}`,
    `\nCurrent rules:\n${state.best.rules ?? "(none)"}`,
    fewShotInfo,
    avoid,
    `\nPropose exactly ONE change targeting the weakest field or biggest failure cluster.`,
    `You may change: "rules" (string), "fewShotSampleIds" (array of sample ids), or`,
    `"schemaHints" (array of {field, type?, required?}). Make a single focused change.`,
    `\nReturn ONLY a JSON object: {"hypothesis": "<one line>", "patch": { ... }}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const MAX_ATTEMPTS = 3;

export async function proposeMutation(state: LoopState, deps: MutatorDeps): Promise<MutationProposal> {
  const prompt = buildPrompt(state);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const text = await deps.generate(prompt);
    const proposal = parseProposal(text);
    if (proposal) return proposal;
  }
  throw new Error("mutator: no valid proposal after retries");
}

/** Production generate: calls the strong tuning model via the AI SDK. */
export function makeLiveGenerate(signal?: AbortSignal): MutatorDeps["generate"] {
  return async (prompt) => {
    const { text } = await generateText({
      model: anthropic(modelId("tuning")),
      abortSignal: signal,
      prompt,
    });
    return text;
  };
}
