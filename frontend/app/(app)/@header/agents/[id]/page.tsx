import { getAgent } from "@/lib/queries/agents";
import { PageHeader } from "@/components/layout/page-header";

export default async function AgentHeaderSlot({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await getAgent(id);

  return <PageHeader title={agent?.name} />;
}
