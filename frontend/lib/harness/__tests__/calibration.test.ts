import { describe, expect, it } from "vitest";
import { applyCalibration, calibrate } from "../calibration";

describe("calibration", () => {
  it("smooths small samples with a Beta(1,1) prior", () => {
    // 2/2 passing in the 0.9-1.0 bin should not return 1.0 — it returns 3/4.
    const map = calibrate([
      { confidence: 0.95, passed: true },
      { confidence: 0.92, passed: true },
    ]);
    const top = map[map.length - 1];
    expect(top.empirical).toBeCloseTo(0.75, 5);
  });

  it("empty bins return the Beta(1,1) mean (0.5)", () => {
    const map = calibrate([]);
    for (const bin of map) expect(bin.empirical).toBeCloseTo(0.5, 5);
  });

  it("is non-decreasing across bins (PAV)", () => {
    // A noisy run where the 0.8-0.9 bin happens to fail and the 0.6-0.7 bin
    // happens to pass. Without PAV the raw empirical would invert.
    const map = calibrate([
      { confidence: 0.65, passed: true },
      { confidence: 0.66, passed: true },
      { confidence: 0.85, passed: false },
      { confidence: 0.86, passed: false },
    ]);
    for (let i = 1; i < map.length; i++) {
      expect(map[i].empirical).toBeGreaterThanOrEqual(map[i - 1].empirical);
    }
  });

  it("converges toward raw empirical with enough data", () => {
    // 100 samples at 0.95, 90 pass, 10 fail → should land near 0.9.
    const pairs = [
      ...Array.from({ length: 90 }, () => ({ confidence: 0.95, passed: true })),
      ...Array.from({ length: 10 }, () => ({ confidence: 0.95, passed: false })),
    ];
    const top = calibrate(pairs)[9];
    expect(top.empirical).toBeGreaterThan(0.88);
    expect(top.empirical).toBeLessThan(0.91);
  });

  it("applyCalibration returns identity when map is null/empty", () => {
    expect(applyCalibration(null, 0.83)).toBe(0.83);
    expect(applyCalibration([], 0.5)).toBe(0.5);
  });

  it("applyCalibration maps a raw confidence to its bin's empirical", () => {
    const map = calibrate([
      { confidence: 0.95, passed: true },
      { confidence: 0.92, passed: true },
    ]);
    expect(applyCalibration(map, 0.97)).toBeCloseTo(0.75, 5);
  });
});
