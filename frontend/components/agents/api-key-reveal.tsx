"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import * as Icons from "@/components/icons";

export function ApiKeyReveal({ apiKey }: { apiKey: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      toast.success("API key copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed. Select and copy manually.");
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
      <code className="flex-1 truncate font-mono text-xs">{apiKey}</code>
      <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={copy}>
        {copied ? <Icons.Check className="size-4" /> : <Icons.Json className="size-4" />}
        <span className="sr-only">Copy</span>
      </Button>
    </div>
  );
}
