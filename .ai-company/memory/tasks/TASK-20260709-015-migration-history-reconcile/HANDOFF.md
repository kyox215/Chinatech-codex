# Handoff

Current state:
- One scoped migration has been created and transaction-preflighted.
- CLI linked migration commands are blocked by missing `SUPABASE_ACCESS_TOKEN`; use Supabase MCP for apply/verification if CLI remains unavailable.
- Do not use `--include-all`.
- Do not apply offline sync draft migrations unless the owner separately approves the offline sync server write strategy.

Next:
- Run local diff checks.
- Commit and push the scoped migration/task memory.
- Apply `20260709125247_repairdesk_historical_schema_reconcile.sql`.
- Verify remote objects and migration history.
