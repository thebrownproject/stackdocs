import { Fragment } from "react";
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
import { flatten } from "@/lib/harness/flatten";
import type { FailureReport } from "@/types/agents";

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return typeof v === "string" ? v : JSON.stringify(v);
}

export function FailureDrilldown({ report }: { report: FailureReport | null }) {
  if (!report || report.rows.length === 0) return null;

  const { fields, rows, perField, phase } = report;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Where it failed</CardTitle>
        <CardDescription>
          Per-sample results from the latest {phase === "held_out" ? "held-out" : phase} run.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sample</TableHead>
              {fields.map((f) => (
                <TableHead key={f} className="text-center">
                  <span className="block">{f}</span>
                  {perField[f] && (
                    <span className="text-xs font-normal text-muted-foreground tabular-nums">
                      {(perField[f].accuracy * 100).toFixed(0)}%
                    </span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const flatExpected = flatten(row.expected);
              const flatOutput = flatten(row.output);
              const failedFields = fields.filter((f) => row.perFieldPassed[f] === false);
              return (
                <Fragment key={row.sampleId}>
                  <TableRow>
                    <TableCell className="font-medium">{row.filename ?? row.sampleId.slice(0, 8)}</TableCell>
                    {fields.map((f) => (
                      <TableCell key={f} className="text-center">
                        {row.perFieldPassed[f] === false ? (
                          <Icons.AlertCircle className="mx-auto size-4 text-destructive" />
                        ) : row.perFieldPassed[f] === true ? (
                          <Icons.Check className="mx-auto size-4 text-green-600" />
                        ) : (
                          <span className="text-muted-foreground">·</span>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  {failedFields.length > 0 && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={fields.length + 1} className="pt-0 pb-3">
                        <div className="flex flex-col gap-1 pl-2 text-xs">
                          {failedFields.map((f) => (
                            <div key={f} className="flex flex-wrap gap-x-3 text-muted-foreground">
                              <span className="font-medium text-foreground">{f}</span>
                              <span>expected: <code className="font-mono">{show(flatExpected[f])}</code></span>
                              <span>got: <code className="font-mono text-destructive">{show(flatOutput[f])}</code></span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
