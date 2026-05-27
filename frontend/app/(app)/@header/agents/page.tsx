import { PageHeader } from "@/components/layout/page-header";
import { CreateAgentButton } from "@/components/agents/create-agent-button";

export default function AgentsHeaderSlot() {
  return <PageHeader actions={<CreateAgentButton />} />;
}
