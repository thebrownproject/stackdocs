"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import * as Icons from "@/components/icons";
import { ApiKeyReveal } from "@/components/agents/api-key-reveal";

export function CreateAgentButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ id: string; apiKey: string } | null>(null);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create agent");
      setCreated({ id: data.agent.id, apiKey: data.apiKey });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setOpen(false);
    if (created) router.push(`/agents/${created.id}`);
    setName("");
    setCreated(null);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Icons.Plus className="size-4" />
          New agent
        </Button>
      </DialogTrigger>
      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Agent created</DialogTitle>
              <DialogDescription>
                Copy your API key now. It is shown only once and stored as a hash.
              </DialogDescription>
            </DialogHeader>
            <ApiKeyReveal apiKey={created.apiKey} />
            <DialogFooter>
              <Button onClick={close}>Open agent</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>New agent</DialogTitle>
              <DialogDescription>Name the document type this agent will extract.</DialogDescription>
            </DialogHeader>
            <Input
              autoFocus
              placeholder="e.g. Supplier invoices"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
            <DialogFooter>
              <Button onClick={create} disabled={busy || !name.trim()}>
                {busy ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
