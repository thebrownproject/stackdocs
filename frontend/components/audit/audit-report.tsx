import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auditVerdict, estimateReviewRate } from "@/lib/audit/verdict";
import type { AuditData, AuditSample } from "@/lib/queries/audit";
import { ReviewRateSlider } from "./review-rate-slider";

function pct(value: number | null | undefined): string {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "n/a";
}

function samplePassRate(sample: AuditSample): number {
  const values = Object.values(sample.per_field_passed);
  if (values.length === 0) return 0;
  return values.filter(Boolean).length / values.length;
}

function representativeSamples(samples: AuditSample[]): AuditSample[] {
  if (samples.length <= 5) return samples;
  const sorted = [...samples].sort((a, b) => samplePassRate(b) - samplePassRate(a));
  const picked = new Map<string, AuditSample>();
  picked.set(sorted[0].id, sorted[0]);
  picked.set(sorted[sorted.length - 1].id, sorted[sorted.length - 1]);

  const failedCounts = new Map<string, number>();
  for (const sample of samples) {
    for (const [field, passed] of Object.entries(sample.per_field_passed)) {
      if (!passed) failedCounts.set(field, (failedCounts.get(field) ?? 0) + 1);
    }
  }
  const mostFailedField = [...failedCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (mostFailedField) {
    for (const sample of samples.filter((s) => !s.per_field_passed[mostFailedField]).sort((a, b) => a.id.localeCompare(b.id))) {
      picked.set(sample.id, sample);
      if (picked.size >= 5) break;
    }
  }
  return [...picked.values()].slice(0, 5);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function AuditReport({ audit }: { audit: AuditData }) {
  const perField = audit.eval_run.per_field_scores ?? {};
  const perFieldAccuracy = Object.values(perField).map((row) => row.accuracy);
  const reviewRate = estimateReviewRate(audit.samples, 0.7);
  const verdict = auditVerdict({
    overallAccuracy: audit.eval_run.overall_accuracy,
    perFieldAccuracy,
    estimatedReviewRate: reviewRate,
  });
  const titleCompany = audit.link.prospect_company || audit.agent.name;
  const selectedSamples = representativeSamples(audit.samples);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8">
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Trestle accuracy audit</span>
            <span>{audit.eval_run.completed_at ? new Date(audit.eval_run.completed_at).toLocaleDateString() : ""}</span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold">{titleCompany}</h1>
              {audit.link.prospect_name && (
                <p className="mt-1 text-sm text-muted-foreground">Prepared for {audit.link.prospect_name}</p>
              )}
            </div>
            <Badge variant={verdict.grade === "ready" ? "default" : "secondary"}>{verdict.title}</Badge>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Held-out accuracy</CardTitle>
            </CardHeader>
            <CardContent className="text-4xl font-semibold tabular-nums">{pct(audit.eval_run.overall_accuracy)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Samples tested</CardTitle>
            </CardHeader>
            <CardContent className="text-4xl font-semibold tabular-nums">{audit.eval_run.sample_count ?? audit.samples.length}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Estimated review</CardTitle>
            </CardHeader>
            <CardContent className="text-4xl font-semibold tabular-nums">{pct(reviewRate)}</CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Verdict</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{verdict.body}</CardContent>
        </Card>

        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Per-field accuracy</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Scorer</TableHead>
                    <TableHead className="text-right">Passed</TableHead>
                    <TableHead className="text-right">Accuracy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(perField).map(([field, row]) => (
                    <TableRow key={field}>
                      <TableCell className="font-medium">{field}</TableCell>
                      <TableCell>{row.scorer}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.passed}/{row.total}</TableCell>
                      <TableCell className="text-right tabular-nums">{pct(row.accuracy)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <ReviewRateSlider samples={audit.samples} />
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Representative samples</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {selectedSamples.map((sample) => (
              <div key={sample.id} className="rounded-md border p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium">{sample.filename}</h3>
                  <Badge variant="outline">{pct(samplePassRate(sample))}</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead>Extracted</TableHead>
                      <TableHead className="text-right">Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.keys(sample.expected_output).map((field) => (
                      <TableRow key={field}>
                        <TableCell className="font-medium">{field}</TableCell>
                        <TableCell>{formatValue(sample.expected_output[field])}</TableCell>
                        <TableCell>{formatValue(sample.predicted_output[field])}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={sample.per_field_passed[field] ? "secondary" : "destructive"}>
                            {sample.per_field_passed[field] ? "pass" : "fail"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </CardContent>
        </Card>

        <footer className="pb-8 text-sm text-muted-foreground">
          Want to run this on live documents? Reply to the email that sent this report.
        </footer>
      </div>
    </main>
  );
}
