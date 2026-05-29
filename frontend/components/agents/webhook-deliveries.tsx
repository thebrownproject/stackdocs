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
import type { WebhookDelivery } from "@/types/agents";

export function WebhookDeliveries({ deliveries }: { deliveries: WebhookDelivery[] }) {
  if (deliveries.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Webhook deliveries</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Result</TableHead>
              <TableHead className="text-right">Status</TableHead>
              <TableHead className="text-right">Attempts</TableHead>
              <TableHead>Error</TableHead>
              <TableHead className="text-right">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveries.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <Badge variant={d.ok ? "outline" : "destructive"}>{d.ok ? "delivered" : "failed"}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{d.status_code ?? "n/a"}</TableCell>
                <TableCell className="text-right tabular-nums">{d.attempts}</TableCell>
                <TableCell className="max-w-[20rem] truncate text-muted-foreground">{d.error ?? "n/a"}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {new Date(d.created_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
