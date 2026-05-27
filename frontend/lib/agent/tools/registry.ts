// Per-agent custom tools — the forward-deployed seam.
//
// The shared runtime ships deterministic built-ins (calculate, validate_date).
// For a specific customer/agent, register their bespoke validation/lookup tools
// here (e.g. "look this vendor up in their ERP", "check this PO exists"). Both
// production extraction and the training harness merge these in, so the agent is
// tuned and measured with the same tools it runs with in production.
//
// Example (in a customer-specific module imported at startup):
//   import { tool } from "ai";
//   import { z } from "zod";
//   registerAgentTools("<agent-id>", {
//     lookup_vendor: tool({
//       description: "Resolve a vendor name to its canonical record.",
//       inputSchema: z.object({ name: z.string() }),
//       execute: async ({ name }) => myErp.findVendor(name),
//     }),
//   });

import type { ToolSet } from "ai";

const REGISTRY: Record<string, ToolSet> = {};

/** Register (or extend) the tool set for a specific agent. */
export function registerAgentTools(agentId: string, tools: ToolSet): void {
  REGISTRY[agentId] = { ...(REGISTRY[agentId] ?? {}), ...tools };
}

/** Tools registered for an agent, merged with the built-ins by the runtime. */
export function getAgentTools(agentId: string): ToolSet | undefined {
  return REGISTRY[agentId];
}
