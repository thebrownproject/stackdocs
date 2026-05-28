// Embeddable inference API-key helpers. Keys are shown once on creation and
// stored only as a sha256 hash. The /api/extract endpoint authenticates by
// hashing the presented Bearer token and matching agents.api_key_hash.

import { createHash, randomBytes } from "node:crypto";

const PREFIX = "trk_"; // Trestle key

export function generateApiKey(): { key: string; hash: string } {
  const key = PREFIX + randomBytes(24).toString("hex");
  return { key, hash: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Extract a Bearer token from an Authorization header. */
export function bearerFrom(header: string | null): string | null {
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
