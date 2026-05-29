import { describe, expect, it } from "vitest";
import { auditVerdict, estimateReviewRate } from "../verdict";

describe("auditVerdict", () => {
  it("marks strong held-out runs as pilot-ready", () => {
    expect(
      auditVerdict({
        overallAccuracy: 0.96,
        perFieldAccuracy: [1, 0.92, 0.86],
        estimatedReviewRate: 0.1,
      }).grade,
    ).toBe("ready");
  });

  it("keeps medium runs in review-assisted pilot territory", () => {
    expect(
      auditVerdict({
        overallAccuracy: 0.88,
        perFieldAccuracy: [0.9, 0.72],
        estimatedReviewRate: 0.4,
      }).grade,
    ).toBe("pilot");
  });

  it("asks for more samples when accuracy is too low", () => {
    expect(
      auditVerdict({
        overallAccuracy: 0.69,
        perFieldAccuracy: [0.9, 0.4],
        estimatedReviewRate: 0.5,
      }).grade,
    ).toBe("needs_samples");
  });
});

describe("estimateReviewRate", () => {
  it("uses the minimum field confidence per sample", () => {
    expect(
      estimateReviewRate(
        [
          { confidence_scores: { vendor: 0.95, total: 0.91 } },
          { confidence_scores: { vendor: 0.95, total: 0.61 } },
          { confidence_scores: {} },
        ],
        0.7,
      ),
    ).toBe(2 / 3);
  });
});
