import { getAgents } from "@/lib/queries/agents";
import { AgentsTable } from "@/components/agents/agents-table";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = await getAgents();

  return <AgentsTable agents={agents} />;
}
