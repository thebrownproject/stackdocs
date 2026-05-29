// Confidence calibration: map the model's emitted confidence onto the empirically
// observed pass-rate, so "0.9 confident" means "~90% likely correct".
//
// 10-bin reliability mapping with two corrections so small samples don't lie:
//  1. Beta(1,1) (Laplace) smoothing per bin: (passed + 1) / (count + 2). A bin
//     with 2/2 passing returns 0.75 instead of 1.0; an empty bin returns 0.5.
//  2. Pool-adjacent-violators (PAV) monotonic regression: merges any bin whose
//     smoothed value dips below the previous, so calibration is non-decreasing.
//     Prevents inversions like raw 0.9 → 0.6 while raw 0.7 → 0.85 from noise.

export interface CalibrationBin {
  lower: number;
  upper: number;
  empirical: number;
  count: number;
}

export type CalibrationMap = CalibrationBin[];

const BIN_COUNT = 10;
const PRIOR_ALPHA = 1; // Beta(1,1) = Laplace smoothing
const PRIOR_BETA = 1;

export function calibrate(pairs: Array<{ confidence: number; passed: boolean }>): CalibrationMap {
  const bins: CalibrationMap = [];
  for (let i = 0; i < BIN_COUNT; i++) {
    const lower = i / BIN_COUNT;
    const upper = (i + 1) / BIN_COUNT;
    const inBin = pairs.filter(
      (p) =>
        p.confidence >= lower && (p.confidence < upper || (i === BIN_COUNT - 1 && p.confidence <= upper)),
    );
    const passed = inBin.filter((p) => p.passed).length;
    const empirical = (passed + PRIOR_ALPHA) / (inBin.length + PRIOR_ALPHA + PRIOR_BETA);
    bins.push({ lower, upper, empirical, count: inBin.length });
  }
  return enforceMonotonic(bins);
}

// Pool-adjacent-violators: walk left-to-right, merge any bin whose empirical is
// below the running max into a pooled group whose shared empirical is the
// posterior over the union of their (passed, count) totals. Result is
// non-decreasing across bins.
function enforceMonotonic(bins: CalibrationMap): CalibrationMap {
  if (bins.length === 0) return bins;
  interface Pool {
    indices: number[];
    passed: number;
    count: number;
    empirical: number;
  }
  const pools: Pool[] = [];
  for (let i = 0; i < bins.length; i++) {
    const b = bins[i];
    const passedInBin = Math.round(b.empirical * (b.count + PRIOR_ALPHA + PRIOR_BETA) - PRIOR_ALPHA);
    let pool: Pool = {
      indices: [i],
      passed: Math.max(0, passedInBin),
      count: b.count,
      empirical: b.empirical,
    };
    while (pools.length > 0 && pools[pools.length - 1].empirical > pool.empirical) {
      const prev = pools.pop()!;
      pool = {
        indices: [...prev.indices, ...pool.indices],
        passed: prev.passed + pool.passed,
        count: prev.count + pool.count,
        empirical:
          (prev.passed + pool.passed + PRIOR_ALPHA) /
          (prev.count + pool.count + PRIOR_ALPHA + PRIOR_BETA),
      };
    }
    pools.push(pool);
  }
  const out = bins.map((b) => ({ ...b }));
  for (const pool of pools) {
    for (const idx of pool.indices) out[idx].empirical = pool.empirical;
  }
  return out;
}

/** Map a raw confidence to its calibrated value. Identity when no map. */
export function applyCalibration(map: CalibrationMap | null | undefined, confidence: number): number {
  if (!map || map.length === 0) return confidence;
  const bin = map.find((b) => confidence >= b.lower && confidence <= b.upper);
  return bin ? bin.empirical : confidence;
}
