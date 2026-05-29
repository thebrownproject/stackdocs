"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { FieldSchemaEntry } from "@/types/agents";

interface Props {
  agentId: string;
  reviewId: string;
  label: string;
  fieldSchema: FieldSchemaEntry[] | null;
}

function template(fieldSchema: FieldSchemaEntry[] | null): string {
  if (!fieldSchema || fieldSchema.length === 0) return "{\n  \n}";
  const obj: Record<string, string> = {};
  for (const f of fieldSchema) obj[f.name] = "";
  return JSON.stringify(obj, null, 2);
}

export function ReviewResolve({ agentId, reviewId, label, fieldSchema }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(() => template(fieldSchema));
  const [busy, setBusy] = useState(false);

  async function submit() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
    } catch {
      toast.error("Corrected fields must be a JSON object");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/review/${reviewId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correctedFields: parsed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to resolve");
      toast.success("Resolved. Saved as a correction sample.");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resolve");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Resolve
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve review</DialogTitle>
          <DialogDescription>
            Enter the correct values for {label}. This is saved as a labelled correction and feeds the next training run.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={10}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="font-mono text-xs"
        />
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save correction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
