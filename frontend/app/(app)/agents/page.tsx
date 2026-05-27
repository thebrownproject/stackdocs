import { getAgents } from "@/lib/queries/agents";
import { AgentsTable } from "@/components/agents/agents-table";

export default async function AgentsPage() {
  const agents = await getAgents();

  return <AgentsTable agents={agents} />;
}
