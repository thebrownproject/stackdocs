import { notFound } from "next/navigation";
import { getAgent, getAgentDeliveries, getAgentFailures } from "@/lib/queries/agents";
import { AgentDetailView } from "@/components/agents/agent-detail";
import { FailureDrilldown } from "@/components/agents/failure-drilldown";
import { WebhookDeliveries } from "@/components/agents/webhook-deliveries";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [agent, failures, deliveries] = await Promise.all([
    getAgent(id),
    getAgentFailures(id),
    getAgentDeliveries(id),
  ]);

  if (!agent) notFound();

  return (
    <div className="flex flex-col gap-4 p-4">
      <AgentDetailView agent={agent} />
      <FailureDrilldown report={failures} />
      <WebhookDeliveries deliveries={deliveries} />
    </div>
  );
}
