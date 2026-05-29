export interface VerdictInput {
  overallAccuracy: number | null;
  perFieldAccuracy: number[];
  estimatedReviewRate: number;
}

export interface Verdict {
  grade: "ready" | "pilot" | "needs_samples";
  title: string;
  body: string;
}

export function auditVerdict(input: VerdictInput): Verdict {
  const overall = input.overallAccuracy ?? 0;
  const lowestField = input.perFieldAccuracy.length > 0 ? Math.min(...input.perFieldAccuracy) : overall;

  if (overall >= 0.95 && lowestField >= 0.85 && input.estimatedReviewRate <= 0.2) {
    return {
      grade: "ready",
      title: "Ready for a paid pilot",
      body: "The held-out set is strong enough to process production documents with human review for lower-confidence cases.",
    };
  }

  if (overall >= 0.85 && lowestField >= 0.7) {
    return {
      grade: "pilot",
      title: "Pilot-worthy with review",
      body: "The agent is useful now, but the weaker fields should stay in the review loop until more examples are added.",
    };
  }

  return {
    grade: "needs_samples",
    title: "Needs more labelled samples",
    body: "The current sample set is not yet reliable enough for production. Add examples around the failing fields, then retrain.",
  };
}

export function estimateReviewRate(
  samples: Array<{ confidence_scores: Record<string, unknown> }>,
  threshold = 0.7,
): number {
  if (samples.length === 0) return 0;
  const needsReview = samples.filter((sample) => {
    const scores = Object.values(sample.confidence_scores).filter((value): value is number => typeof value === "number");
    return scores.length === 0 || Math.min(...scores) < threshold;
  });
  return needsReview.length / samples.length;
}
