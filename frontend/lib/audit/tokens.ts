import { randomBytes } from "node:crypto";

export function generateAuditToken(): string {
  return randomBytes(24).toString("base64url");
}
