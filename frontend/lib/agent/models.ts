// Anthropic model ids used across the runtime and harness.

export const MODELS = {
  // High-stakes tuning / orchestration.
  tuning: "claude-opus-4-7",
  // Default production inference.
  inference: "claude-sonnet-4-6",
  // Cheap, high-volume inference.
  cheap: "claude-haiku-4-5",
} as const;

export type ModelTier = keyof typeof MODELS;

export function modelId(tier: ModelTier = "inference"): string {
  return MODELS[tier];
}
