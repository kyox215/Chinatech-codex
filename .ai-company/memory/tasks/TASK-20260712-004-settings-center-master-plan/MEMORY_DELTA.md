# Memory Delta

- Settings capability fields must be projected by `storePermissionsFromActor`; clients use `=== true` and do not recreate the role matrix.
- One-time invite and kiosk codes are tenant-bound, response-confirmed, generation-bound, expiring, and never stored in query cache, URL, browser storage, logs, Toast text, or task memory.
- Customer-facing output identity comes only from the active tenant settings/store context. Missing required identity blocks output, and known legacy ChinaTech/Floridia fallback fingerprints are quarantined for non-default tenants.
- The original checkout is dirty; implementation remains in the isolated `/private/tmp` worktree until scoped integration.
