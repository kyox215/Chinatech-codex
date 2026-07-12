# Memory Delta

- Settings capability fields must be projected by `storePermissionsFromActor`; clients use `=== true` and do not recreate the role matrix.
- One-time invite and kiosk codes are tenant-bound, response-confirmed, generation-bound, expiring, and never stored in query cache, URL, browser storage, logs, Toast text, or task memory.
- Customer-facing output identity comes only from the active tenant settings/store context. Missing required identity blocks output, and known legacy ChinaTech/Floridia fallback fingerprints are quarantined for non-default tenants.
- The original checkout is dirty; implementation remains in the isolated `/private/tmp` worktree until scoped integration.
- `/settings` is a query-param shell whose empty or invalid section resolves to overview; the four-group/nine-section registry is the navigation source of truth.
- Settings business queries activate only for the current view and server capability; the Settings workspace has no global speculative preload.
- Store-scoped editable drafts must carry explicit active-store provenance and reject late responses whose request, response, cache, and current store do not agree.
- Member self-protection uses membership identity, not an account-profile query hidden behind another section.
- Store settings updates use one strict `store / notifications / rules` request union. The actor store authorizes the request; client `expectedStoreId` only detects stale context.
- Section saves use `store_id + updated_at` CAS and never send derived warranty text. A stale version is a stable 409 with no audit or Realtime side effect.
- Dirty section refresh is fail-safe: local input is retained, server-only fields are absorbed only through explicit base/local/server rebase, and rebase never auto-saves.
- One pending navigation transition must resolve every dirty section and every registered draft source before it runs. Application Links, imperative routes, store mutations, sign-out, and history use the shared guard; hard reload uses native `beforeunload`.
- Store switch/create failures clear transient one-time codes but do not clear the current settings draft. Successful active-store changes still reset all tenant-scoped local state.
- Settings update and audit are not transactionally atomic, Realtime is best-effort, and missing settings rows still initialize on read; these are explicit release risks, not completed guarantees.
