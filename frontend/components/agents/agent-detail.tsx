import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as Icons from "@/components/icons";
import { SampleUpload } from "@/components/agents/sample-upload";
import { TrainButton } from "@/components/agents/train-button";
import { ConnectionPanel } from "@/components/agents/connection-panel";
import { ReviewResolve } from "@/components/agents/review-resolve";
import type { AgentDetail, AgentStatus } from "@/types/agents";

const STATUS_VARIANT: Record<AgentStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  trained: "secondary",
  draft: "outline",
};

function pct(n: number | null | undefined): string {
  return typeof n === "number" ? `${(n * 100).toFixed(1)}%` : "—";
}

function dateTime(s: string | null): string {
  return s ? new Date(s).toLocaleString() : "—";
}

export function AgentDetailView({ agent }: { agent: AgentDetail }) {
  const perField = agent.accuracy_summary?.per_field ?? {};

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">{agent.name}</h1>
        <Badge variant={STATUS_VARIANT[agent.status]}>{agent.status}</Badge>
        {agent.pending_review_count > 0 && (
          <Badge variant="destructive">{agent.pending_review_count} to review</Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Held-out accuracy</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {pct(agent.accuracy_summary?.overall)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {agent.active_bundle_version
              ? `Active bundle v${agent.active_bundle_version}`
              : "No active bundle yet"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Embeddable API</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-xs">
            <span className="flex items-center gap-1.5">
              {agent.has_api_key ? (
                <Icons.Check className="size-3.5 text-green-600" />
              ) : (
                <Icons.AlertCircle className="size-3.5 text-muted-foreground" />
              )}
              {agent.has_api_key ? "API key configured" : "No API key"}
            </span>
            <span className="flex items-center gap-1.5">
              <Icons.Send className="size-3.5 text-muted-foreground" />
              {agent.webhook_url ? agent.webhook_url : "No webhook configured"}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Samples</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl tabular-nums">{agent.sample_count}</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Train</CardTitle>
            <CardDescription>Add labelled samples, then train to produce a measured bundle.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <SampleUpload agentId={agent.id} />
            <TrainButton agentId={agent.id} disabled={agent.sample_count < 2} />
            {agent.sample_count < 2 && (
              <p className="text-xs text-muted-foreground">Add at least 2 samples to train.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Connections</CardTitle>
            <CardDescription>How documents reach this agent and where results go.</CardDescription>
          </CardHeader>
          <CardContent>
            <ConnectionPanel
              agentId={agent.id}
              hasApiKey={agent.has_api_key}
              webhookUrl={agent.webhook_url}
              hasWebhookSecret={agent.has_webhook_secret}
              inboundToken={agent.inbound_email_token}
              hasActiveBundle={Boolean(agent.active_bundle_version)}
            />
          </CardContent>
        </Card>
      </div>

      {agent.field_schema && agent.field_schema.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Extraction schema</CardTitle>
            <CardDescription>Fields produced by the active bundle</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col divide-y text-sm">
              {agent.field_schema.map((f) => (
                <div key={f.name} className="flex items-center justify-between py-1.5">
                  <span className="font-medium">{f.name}</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="tabular-nums">{pct(perField[f.name])}</span>
                    <Badge variant="outline">{f.type}</Badge>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Training runs</CardTitle>
        </CardHeader>
        <CardContent>
          {agent.eval_runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No training runs yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phase</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Accuracy</TableHead>
                  <TableHead className="text-right">Samples</TableHead>
                  <TableHead className="text-right">Bundle</TableHead>
                  <TableHead className="text-right">Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agent.eval_runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">{run.phase}</TableCell>
                    <TableCell>
                      <Badge variant={run.status === "error" ? "destructive" : "outline"}>
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{pct(run.overall_accuracy)}</TableCell>
                    <TableCell className="text-right tabular-nums">{run.sample_count ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {run.bundle_version ? `v${run.bundle_version}` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{dateTime(run.started_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {agent.review_items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Review queue</CardTitle>
            <CardDescription>Low-confidence extractions awaiting human review</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Min confidence</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agent.review_items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.filename ?? item.document_id}</TableCell>
                    <TableCell>{item.reason}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(item.min_confidence)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{dateTime(item.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <ReviewResolve
                        agentId={agent.id}
                        reviewId={item.id}
                        label={item.filename ?? item.document_id}
                        fieldSchema={agent.field_schema}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
