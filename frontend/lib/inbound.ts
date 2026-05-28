// Inbound email-in stub. The address is derived from the agent's stable token;
// an inbound email provider will later route doc-<token>@<domain> to /api/extract.

export const INBOUND_EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_INBOUND_EMAIL_DOMAIN ?? "inbound.trestle.dev";

export function inboundAddress(token: string | null): string | null {
  return token ? `doc-${token}@${INBOUND_EMAIL_DOMAIN}` : null;
}
