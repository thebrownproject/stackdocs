import { notFound } from "next/navigation";
import { getAgent } from "@/lib/queries/agents";
import { AgentDetailView } from "@/components/agents/agent-detail";

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await getAgent(id);

  if (!agent) notFound();

  return <AgentDetailView agent={agent} />;
}
