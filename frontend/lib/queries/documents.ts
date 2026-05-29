import { createServerSupabaseClient } from "@/lib/supabase-server";
import { demoDocuments, isDemoMode } from "@/lib/demo-data";
import type { Document, DocumentStatus } from "@/types/documents";

export async function getDocuments(): Promise<Document[]> {
  if (isDemoMode) return demoDocuments;

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("documents")
    .select("id, filename, mime_type, file_size_bytes, status, uploaded_at, agent_id, agents(name)")
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error("Error fetching documents:", error);
    return [];
  }

  return (data ?? []).map((doc) => {
    const agent = (Array.isArray(doc.agents) ? doc.agents[0] : doc.agents) as { name?: string } | null;
    return {
      id: doc.id,
      filename: doc.filename,
      mime_type: doc.mime_type,
      file_size_bytes: doc.file_size_bytes,
      status: doc.status as DocumentStatus,
      uploaded_at: doc.uploaded_at,
      agent_id: doc.agent_id,
      agent_name: agent?.name ?? null,
    };
  });
}
