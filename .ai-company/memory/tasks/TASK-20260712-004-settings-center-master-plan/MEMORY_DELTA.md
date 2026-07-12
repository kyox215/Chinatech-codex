# Memory Delta

- Settings capability fields must be projected by `storePermissionsFromActor`; clients use `=== true` and do not recreate the role matrix.
- One-time invite and kiosk codes are tenant-bound, response-confirmed, generation-bound, expiring, and never stored in query cache, URL, browser storage, logs, Toast text, or task memory.
- Customer-facing output identity comes only from the active tenant settings/store context. Missing required identity blocks output, and known legacy ChinaTech/Floridia fallback fingerprints are quarantined for non-default tenants.
- The original checkout is dirty; implementation remains in the isolated `/private/tmp` worktree until scoped integration.
- `/settings` is a query-param shell whose empty or invalid section resolves to overview; the four-group/nine-section registry is the navigation source of truth.
- Settings business queries activate only for the current view and server capability; the Settings workspace has no global speculative preload.
- Store-scoped editable drafts must carry explicit active-store provenance and reject late responses whose request, response, cache, and current store do not agree.
- Member self-protection uses membership identity, not an account-profile query hidden behind another section.
