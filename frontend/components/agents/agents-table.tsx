import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as Icons from "@/components/icons";
import type { AgentStatus, AgentSummary } from "@/types/agents";

const STATUS_VARIANT: Record<AgentStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  trained: "secondary",
  draft: "outline",
};

function pct(n: number | null | undefined): string {
  return typeof n === "number" ? `${(n * 100).toFixed(1)}%` : "—";
}

export function AgentsTable({ agents }: { agents: AgentSummary[] }) {
  if (agents.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-12 text-center text-muted-foreground">
        <Icons.BrandDatabricks className="size-8" />
        <p className="text-sm">No agents yet.</p>
        <p className="text-xs">Create an agent and upload labelled samples to train it.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Accuracy</TableHead>
            <TableHead className="text-right">Active version</TableHead>
            <TableHead className="text-right">Samples</TableHead>
            <TableHead className="text-right">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((agent) => (
            <TableRow key={agent.id}>
              <TableCell className="font-medium">
                <Link href={`/agents/${agent.id}`} className="hover:underline">
                  {agent.name}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[agent.status]}>{agent.status}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {pct(agent.accuracy_summary?.overall)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {agent.active_bundle_version ? `v${agent.active_bundle_version}` : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">{agent.sample_count}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {new Date(agent.created_at).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
