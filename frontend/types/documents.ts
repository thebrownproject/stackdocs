export type DocumentStatus = "processing" | "ocr_complete" | "completed" | "failed";

export interface Document {
  id: string;
  filename: string;
  mime_type: string;
  file_size_bytes: number;
  status: DocumentStatus;
  uploaded_at: string;
  agent_id: string | null;
}
