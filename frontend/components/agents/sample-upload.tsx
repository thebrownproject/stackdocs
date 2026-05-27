"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import * as Icons from "@/components/icons";

export function SampleUpload({ agentId }: { agentId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [expected, setExpected] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!file) {
      toast.error("Choose a document");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(expected);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
    } catch {
      toast.error("Expected output must be a JSON object");
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("files", file);
      form.append("expected", JSON.stringify([parsed]));
      const res = await fetch(`/api/agents/${agentId}/samples`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      toast.success("Sample added");
      setFile(null);
      setExpected("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
      />
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Expected output (ground-truth JSON)</span>
        <Textarea
          rows={5}
          placeholder={'{\n  "vendor": "Acme",\n  "total": "$1,000.00"\n}'}
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          className="font-mono text-xs"
        />
      </div>
      <Button onClick={submit} disabled={busy} className="w-fit">
        {busy ? <Icons.Loader2 className="size-4 animate-spin" /> : <Icons.Plus className="size-4" />}
        Add sample
      </Button>
    </div>
  );
}
