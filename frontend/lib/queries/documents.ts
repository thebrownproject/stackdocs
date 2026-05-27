import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { Document, DocumentStatus } from "@/types/documents";

export async function getDocuments(): Promise<Document[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("documents")
    .select("id, filename, mime_type, file_size_bytes, status, uploaded_at, agent_id")
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error("Error fetching documents:", error);
    return [];
  }

  return (data ?? []).map((doc) => ({
    id: doc.id,
    filename: doc.filename,
    mime_type: doc.mime_type,
    file_size_bytes: doc.file_size_bytes,
    status: doc.status as DocumentStatus,
    uploaded_at: doc.uploaded_at,
    agent_id: doc.agent_id,
  }));
}
