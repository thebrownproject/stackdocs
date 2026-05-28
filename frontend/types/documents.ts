export type DocumentStatus =
  | "processing"
  | "ocr_complete"
  | "completed"
  | "extracted"
  | "needs_review"
  | "failed";

export interface Document {
  id: string;
  filename: string;
  mime_type: string;
  file_size_bytes: number;
  status: DocumentStatus;
  uploaded_at: string;
  agent_id: string | null;
  agent_name: string | null;
}
