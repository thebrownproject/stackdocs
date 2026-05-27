// Confidence calibration: map the model's emitted confidence onto the empirically
// observed pass-rate, so "0.9 confident" means "~90% likely correct".
// MVP: simple 10-bin reliability mapping; identity when there's no data.

export interface CalibrationBin {
  lower: number;
  upper: number;
  empirical: number;
  count: number;
}

export type CalibrationMap = CalibrationBin[];

const BIN_COUNT = 10;

export function calibrate(pairs: Array<{ confidence: number; passed: boolean }>): CalibrationMap {
  const bins: CalibrationMap = [];
  for (let i = 0; i < BIN_COUNT; i++) {
    const lower = i / BIN_COUNT;
    const upper = (i + 1) / BIN_COUNT;
    const inBin = pairs.filter((p) => p.confidence >= lower && (p.confidence < upper || (i === BIN_COUNT - 1 && p.confidence <= upper)));
    const empirical = inBin.length === 0 ? (lower + upper) / 2 : inBin.filter((p) => p.passed).length / inBin.length;
    bins.push({ lower, upper, empirical, count: inBin.length });
  }
  return bins;
}

/** Map a raw confidence to its calibrated value. Identity when no map. */
export function applyCalibration(map: CalibrationMap | null | undefined, confidence: number): number {
  if (!map || map.length === 0) return confidence;
  const bin = map.find((b) => confidence >= b.lower && confidence <= b.upper);
  return bin ? bin.empirical : confidence;
}
