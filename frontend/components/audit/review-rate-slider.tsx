"use client";

import { useMemo, useState } from "react";
import type { AuditSample } from "@/lib/queries/audit";

export function ReviewRateSlider({ samples }: { samples: AuditSample[] }) {
  const [threshold, setThreshold] = useState(70);
  const rate = useMemo(() => {
    if (samples.length === 0) return 0;
    const needsReview = samples.filter((sample) => {
      const scores = Object.values(sample.confidence_scores).filter((value): value is number => typeof value === "number");
      return scores.length === 0 || Math.min(...scores) < threshold / 100;
    }).length;
    return needsReview / samples.length;
  }, [samples, threshold]);

  return (
    <div className="rounded-md border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Review rate estimate</h2>
          <p className="text-xs text-muted-foreground">Based on the minimum field confidence in each held-out sample.</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums">{(rate * 100).toFixed(0)}%</div>
          <div className="text-xs text-muted-foreground">at {threshold}% threshold</div>
        </div>
      </div>
      <input
        type="range"
        min="50"
        max="95"
        step="5"
        value={threshold}
        onChange={(event) => setThreshold(Number(event.target.value))}
        className="mt-4 w-full"
        aria-label="Confidence review threshold"
      />
    </div>
  );
}
