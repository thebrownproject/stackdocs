// Train/test split. Random 80/20 for MVP (stratified sampling is a later refinement).

import type { Sample } from "./types";

/** Deterministic PRNG (mulberry32) so splits are reproducible for a given seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Split {
  train: Sample[];
  test: Sample[];
}

export function splitSamples(samples: Sample[], ratio = 0.8, seed = 42): Split {
  const shuffled = [...samples];
  const rand = mulberry32(seed);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // Guarantee at least one test sample when there are >= 2 samples.
  let testCount = Math.round(shuffled.length * (1 - ratio));
  if (shuffled.length >= 2) testCount = Math.min(Math.max(testCount, 1), shuffled.length - 1);
  const test = shuffled.slice(0, testCount).map((s) => ({ ...s, split: "test" as const }));
  const train = shuffled.slice(testCount).map((s) => ({ ...s, split: "train" as const }));
  return { train, test };
}
