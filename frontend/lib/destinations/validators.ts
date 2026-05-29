import { z } from "zod";

export const webhookConfig = z.object({
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
  payload_template: z.string().optional(),
  secret: z.string().optional(),
});

export const googleSheetsConfig = z.object({
  spreadsheet_id: z.string().min(10),
  sheet_name: z.string().min(1),
  column_mapping: z.record(z.string(), z.string().regex(/^[A-Z]+$/)),
});

export const emailConfig = z.object({
  to: z.string().email(),
  cc: z.array(z.string().email()).optional(),
  subject_template: z.string().min(1),
  body_template: z.string().min(1),
});

export const destinationConfig = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("webhook"), config: webhookConfig }),
  z.object({ kind: z.literal("google_sheets"), config: googleSheetsConfig }),
  z.object({ kind: z.literal("email"), config: emailConfig }),
]);

export type DestinationKind = z.infer<typeof destinationConfig>["kind"];
export type DestinationConfig = z.infer<typeof destinationConfig>;
