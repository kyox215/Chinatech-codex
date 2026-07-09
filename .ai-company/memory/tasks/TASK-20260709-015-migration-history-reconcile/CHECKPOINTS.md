# Checkpoints

## 2026-07-09T12:58:24Z — Created idempotent historical schema reconcile migration and production rollback preflight passed; no production apply yet.

- **Phase:** review
- **Completed/current state:** Created idempotent historical schema reconcile migration and production rollback preflight passed; no production apply yet.
- **Next:** Commit/push scoped migration and task evidence, then apply migration to Supabase project xluzcoduqsdvjoouqhkc via MCP if CLI remains unauthenticated.
- **Decision:** Use a new forward migration instead of include-all or manual migration-history table edits; exclude offline draft migrations and unsafe customer_tag_assignments tag FK.
- **Evidence:**
  - supabase/migrations/20260709125247_repairdesk_historical_schema_reconcile.sql; Supabase MCP row-count and violation checks; BEGIN/ROLLBACK preflight success.
- **Recorded by:** Codex
## 2026-07-09T13:05:08Z — Migration 20260709125247 was pushed to main and applied to Supabase project xluzcoduqsdvjoouqhkc; post-apply checks confirmed migration history, indexes, constraints, inventory trigger, and realtime policy.

- **Phase:** verified
- **Completed/current state:** Migration 20260709125247 was pushed to main and applied to Supabase project xluzcoduqsdvjoouqhkc; post-apply checks confirmed migration history, indexes, constraints, inventory trigger, and realtime policy.
- **Next:** Close task after recording residual risks: CLI repair unavailable without SUPABASE_ACCESS_TOKEN; offline sync drafts and customer_tag_assignments tag FK remain intentionally unapplied.
- **Decision:** Applied a new forward migration and exact history row; did not use include-all; did not apply offline sync drafts; did not add unsafe tag FK.
- **Evidence:**
  - main commit 26d0417d pushed; remote migration history includes 20260709125247 repairdesk_historical_schema_reconcile; post-apply metadata query returned expected indexes/constraints/function/trigger/policy present.
- **Recorded by:** Codex
## 2026-07-09T13:05:17Z — Task closeout

- **Status:** closed
- **Outcome:** Pushed main commit 26d0417d and applied migration 20260709125247_repairdesk_historical_schema_reconcile to Supabase project xluzcoduqsdvjoouqhkc with post-apply verification.
- **Residual risks:** Supabase CLI official migration repair/db push remains unavailable in this shell without SUPABASE_ACCESS_TOKEN; older local-only migration history gaps still require a separate repair plan if strict history parity is desired. Offline sync draft migrations and customer_tag_assignments tag FK were intentionally not applied.
- **Follow-up:** Run official supabase migration repair from an authenticated checkout if historical version parity must be cleaned; separately repair 20 legacy customer_tag_assignments tag rows before adding tag same-store FK.
- **Closed by:** Codex
