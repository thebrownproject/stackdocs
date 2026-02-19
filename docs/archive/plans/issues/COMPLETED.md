# Completed Issues

Archive of resolved issues for reference.

---

| # | Type | Issue | Resolution | Date |
|---|------|-------|------------|------|
| 39 | bug | Tooltip persistence on page navigation | Prevent focus events on TooltipTrigger (Radix issue #2029) | 2026-01-05 |
| 24 | bug | Layout breaks at narrow viewports when sidebar + preview open | Added `overflow-hidden` to ResizablePanelGroup + `min-w-0` to both panels | 2025-12-28 |
| 23 | bug | Chevron expansion resizes Field/Value columns | Added `table-fixed` class and explicit column widths | 2025-12-28 |
| 22 | bug | Visual preview empty on documents list | Combined useEffect fetches signed URL and OCR text in parallel | 2025-12-28 |
| 19 | bug | Checkbox selection not activating sub nav bar actions | Wired up onSelectionChange callback and added SelectionActions | 2025-12-28 |
| 17 | tech-debt | Branding consistency - "StackDocs" vs "Stackdocs" | Replaced 100+ occurrences across frontend, backend, docs, CI/CD | 2025-12-28 |
| 15 | bug | Production RLS failing | Added production Clerk domain (`clerk.stackdocs.io`) to Supabase third-party auth | 2025-12-24 |
| 13 | bug | Clerk auth() not detecting clerkMiddleware() | Next.js 16 requires `export function proxy(req)` wrapper in `proxy.ts` | 2025-12-24 |
| 9 | bug | Clerk UserButton menu items not responding on mobile | Fixed touch event handling in Clerk components | 2025-12-24 |
| 1 | deprecation | Clerk `afterSignInUrl` deprecated | Use `fallbackRedirectUrl` or `forceRedirectUrl` instead | 2025-12-23 |
