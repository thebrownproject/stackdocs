"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import * as Icons from "@/components/icons";

interface StepEvent {
  step?: string;
  complete?: boolean;
  error?: string;
  overall?: number;
  train?: number;
  test?: number;
  sampleCount?: number;
  version?: number;
  accuracy?: number;
  adopted?: boolean;
}

function describe(ev: StepEvent): string | null {
  if (ev.error) return `Error: ${ev.error}`;
  if (ev.complete) return `Promoted bundle v${ev.version} — ${((ev.accuracy ?? 0) * 100).toFixed(1)}% held-out`;
  switch (ev.step) {
    case "load":
      return `Loaded ${ev.sampleCount} samples`;
    case "schema_infer":
      return "Inferred field schema";
    case "split":
      return `Split ${ev.train} train / ${ev.test} test`;
    case "baseline":
      return `Baseline accuracy ${((ev.overall ?? 0) * 100).toFixed(1)}%`;
    case "tune":
      return `Tuned accuracy ${((ev.overall ?? 0) * 100).toFixed(1)}% — rules ${ev.adopted ? "adopted" : "discarded (no gain)"}`;
    case "held_out":
      return `Held-out accuracy ${((ev.overall ?? 0) * 100).toFixed(1)}%`;
    default:
      return null;
  }
}

export function TrainButton({ agentId, disabled }: { agentId: string; disabled?: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  async function train() {
    setRunning(true);
    setLog([]);
    try {
      const res = await fetch(`/api/agents/${agentId}/train`, { method: "POST" });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Training failed to start");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawError: string | null = null;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.replace(/^data:\s*/, "").trim();
          if (!line) continue;
          let ev: StepEvent;
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.error) sawError = ev.error;
          const msg = describe(ev);
          if (msg) setLog((prev) => [...prev, msg]);
        }
      }

      if (sawError) toast.error(sawError);
      else toast.success("Training complete");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Training failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={train} disabled={running || disabled} className="w-fit">
        {running ? <Icons.Loader2 className="size-4 animate-spin" /> : <Icons.Refresh className="size-4" />}
        {running ? "Training…" : "Train"}
      </Button>
      {log.length > 0 && (
        <div className="flex flex-col gap-0.5 rounded-md border bg-muted/40 p-2 font-mono text-xs">
          {log.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
