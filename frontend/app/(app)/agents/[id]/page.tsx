import { notFound } from "next/navigation";
import { getAgent, getAgentFailures } from "@/lib/queries/agents";
import { AgentDetailView } from "@/components/agents/agent-detail";
import { FailureDrilldown } from "@/components/agents/failure-drilldown";

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [agent, failures] = await Promise.all([getAgent(id), getAgentFailures(id)]);

  if (!agent) notFound();

  return (
    <div className="flex flex-col gap-4 p-4">
      <AgentDetailView agent={agent} />
      <FailureDrilldown report={failures} />
    </div>
  );
}
