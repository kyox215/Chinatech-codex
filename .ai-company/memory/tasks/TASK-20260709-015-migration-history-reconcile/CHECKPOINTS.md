# Checkpoints

## 2026-07-09T12:58:24Z — Created idempotent historical schema reconcile migration and production rollback preflight passed; no production apply yet.

- **Phase:** review
- **Completed/current state:** Created idempotent historical schema reconcile migration and production rollback preflight passed; no production apply yet.
- **Next:** Commit/push scoped migration and task evidence, then apply migration to Supabase project xluzcoduqsdvjoouqhkc via MCP if CLI remains unauthenticated.
- **Decision:** Use a new forward migration instead of include-all or manual migration-history table edits; exclude offline draft migrations and unsafe customer_tag_assignments tag FK.
- **Evidence:**
  - supabase/migrations/20260709125247_repairdesk_historical_schema_reconcile.sql; Supabase MCP row-count and violation checks; BEGIN/ROLLBACK preflight success.
- **Recorded by:** Codex
