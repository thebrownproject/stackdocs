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
  const csvRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [csv, setCsv] = useState<File | null>(null);
  const [expected, setExpected] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (files.length === 0) {
      toast.error("Choose at least one document");
      return;
    }

    let parsed: unknown[] | null = null;
    if (!csv) {
      try {
        const value = JSON.parse(expected);
        parsed = files.length === 1 && !Array.isArray(value) ? [value] : value;
        if (
          !Array.isArray(parsed) ||
          parsed.length !== files.length ||
          parsed.some((item) => typeof item !== "object" || item === null || Array.isArray(item))
        ) {
          throw new Error();
        }
      } catch {
        toast.error(files.length === 1 ? "Expected output must be a JSON object" : "Expected output must be a JSON array aligned to files");
        return;
      }
    }

    setBusy(true);
    try {
      const form = new FormData();
      for (const file of files) form.append("files", file);
      if (csv) form.append("expectedCsv", csv);
      else form.append("expected", JSON.stringify(parsed));
      const res = await fetch(`/api/agents/${agentId}/samples`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      toast.success(`${data.inserted} sample${data.inserted === 1 ? "" : "s"} added`);
      setFiles([]);
      setCsv(null);
      setExpected("");
      if (fileRef.current) fileRef.current.value = "";
      if (csvRef.current) csvRef.current.value = "";
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
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.csv,.txt"
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        className="block w-full text-xs file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-2.5 file:py-1.5 file:text-xs file:font-medium hover:file:bg-accent"
      />
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Expected outputs CSV (optional, filename column required)</span>
        <input
          ref={csvRef}
          type="file"
          accept=".csv"
          onChange={(e) => setCsv(e.target.files?.[0] ?? null)}
          className="block w-full text-xs file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-2.5 file:py-1.5 file:text-xs file:font-medium hover:file:bg-accent"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">
          {files.length > 1 ? "Expected outputs JSON array" : "Expected output JSON"}
        </span>
        <Textarea
          rows={5}
          placeholder={'{\n  "vendor": "Acme",\n  "total": "$1,000.00"\n}'}
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          disabled={Boolean(csv)}
          className="font-mono text-xs"
        />
      </div>
      <Button onClick={submit} disabled={busy} className="w-fit">
        {busy ? <Icons.Loader2 className="size-4 animate-spin" /> : <Icons.Plus className="size-4" />}
        Add samples
      </Button>
    </div>
  );
}
