// Normalises an uploaded document into something the model can read. Claude
// reads PDFs and images natively (passed as a file part); document/text formats
// are converted to text first.

import mammoth from "mammoth";

const MODEL_NATIVE = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export type ModelInput =
  | { kind: "file"; data: Uint8Array | URL | string; mediaType: string }
  | { kind: "text"; text: string };

function ext(filename?: string): string {
  return filename?.split(".").pop()?.toLowerCase() ?? "";
}

export async function normalizeToModelInput(
  data: Uint8Array | URL | string,
  mediaType: string,
  filename?: string,
): Promise<ModelInput> {
  // External references / already-resolved URLs are assumed model-native.
  if (typeof data === "string" || data instanceof URL) {
    return { kind: "file", data, mediaType };
  }

  if (MODEL_NATIVE.has(mediaType)) return { kind: "file", data, mediaType };

  const e = ext(filename);

  if (mediaType.includes("wordprocessingml") || e === "docx") {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(data) });
    return { kind: "text", text: value };
  }

  if (mediaType.startsWith("text/") || e === "csv" || e === "txt" || e === "md") {
    return { kind: "text", text: new TextDecoder().decode(data) };
  }

  // Unknown binary: let the model attempt it as a file part.
  return { kind: "file", data, mediaType };
}
