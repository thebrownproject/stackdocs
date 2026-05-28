// Forward-deployed customer wiring. Import each customer's registration module
// here so their custom tools (registerAgentTools) and destination adapters
// (registerDestination) are registered before any extraction runs. This barrel
// is imported for side effects by lib/agent/process.ts.
//
// Example:
//   import "./acme-invoices";   // registers tools + destination for that agent

export {};
