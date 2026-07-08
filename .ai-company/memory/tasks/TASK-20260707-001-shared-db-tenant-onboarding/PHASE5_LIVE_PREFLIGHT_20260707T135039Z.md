# Phase 5 Live Read-Only Preflight Evidence

Timestamp: 2026-07-07T13:50:39Z
Task: TASK-20260707-001-shared-db-tenant-onboarding
Target project ref: xluzcoduqsdvjoouqhkc
Target environment: production-linked Supabase project
Operator: Codex local terminal, approved by Owner in chat
Execution mode: linked CLI read-only/dry-run preflight
Result classification: block

## Approval Defaults Applied

- Owner approved Phase 5 read-only live verification and allowed all previously listed actions.
- Recommended defaults applied:
  - Offline-sync draft migrations remain excluded from production apply.
  - `store_invite_link_attempts.actor_email` should move toward anonymization/cleanup plan.
  - Legacy default-store rows are treated as no-go unless explained as intentional ChinaTech seed/legacy data.
- No production mutation, linked migration apply, schema-cache reload, deploy, push, backfill, anonymization, or Phase 6 rollout was performed.

## Source Hashes

Captured immediately after the preflight commands and before editing the source runbook/query/approval files in this turn.

| File | SHA-256 |
|---|---|
| `docs/SHARED_DB_TENANT_PHASE5_VERIFICATION_RUNBOOK.md` | `559ee23163c602033cca482ff8619fc2ed9c3280cf13607c384fd8cd318f3e1e` |
| `docs/SHARED_DB_TENANT_PHASE5_QUERY_PACK.md` | `6439bc4babbd003cee41cdb31fcba10e3fa3bde79ec16fe1d00387a7ccff9c81` |
| `docs/SHARED_DB_TENANT_PHASE5_APPROVAL_PACKET.md` | `09588f7cc981b9b094678cb2ede3c9b1d5f572abaf05f09e31c18d586e92c39c` |

## Commands Run

| Command | Result | Evidence summary |
|---|---|---|
| `supabase --version` | pass | Installed CLI is `2.101.0`; CLI reported newer `2.109.1` available during later commands. |
| `supabase migration list --linked` | pass with no-go findings | Connected to remote and listed local-vs-remote migration history. Local and remote histories diverge. |
| `supabase db push --linked --dry-run` | block | Dry-run did not apply anything and failed because remote migration versions are not present locally. |
| `supabase db dump --linked --dry-run` | pass | Printed schema-only `pg_dump` script shape. Output was redacted for password/connection material. No dump file or data export was created. |

## Migration History Findings

Remote-only migration versions reported by CLI:

- `20260611103402`
- `20260611103627`
- `20260611171345`
- `20260613101014`
- `20260619194103`
- `20260621074627`
- `20260701214123`

Local-only migration versions include tenant/platform/storage/offline work that is not recorded in remote migration history. Important examples:

- `20260611001527` message templates/settings.
- `20260611002831` enterprise multi-store foundation.
- `20260611005916` tenant constraint hardening.
- `20260611102805` remote schema compatibility.
- `20260613122452` order attachments.
- `20260617143000` inventory attachments.
- `20260619193655` attachment storage repair.
- `20260704190000` private store onboarding requests.
- `20260704221944` store invite links.
- `20260706133632` realtime private broadcast authorization.
- `20260707090000` offline operations draft.
- `20260707110000` offline order sync RPC draft.

The offline draft migrations remain excluded from any production apply unless separately approved.

## No-Go Conclusion

Phase 5 live SQL verification was stopped after CLI preflight because `supabase db push --linked --dry-run` failed on migration history divergence. Continuing the full SQL query pack against a schema whose migration history is not aligned could produce false pass/fail conclusions and would violate the query pack stop condition for CLI preflight.

This is not a production incident by itself. It is a release gate blocker.

## Recommended Remediation Package

Before running the full live SQL query pack:

1. Create a migration-history reconciliation package.
2. Decide how to represent the seven remote-only migrations locally:
   - recover exact SQL files if they exist in another branch/history, or
   - run an Owner-approved `supabase db pull` into an isolated review branch/worktree, then inspect the generated schema diff before merging.
3. Decide which local-only migrations are intended for production now and which remain draft/excluded.
4. Keep `20260707090000_repairdesk_offline_operations.sql` and `20260707110000_repairdesk_offline_order_sync_rpc_draft.sql` excluded unless separately approved.
5. Re-run `supabase migration list --linked` and `supabase db push --linked --dry-run`.
6. Only if dry-run preflight passes or every exception has an approved remediation, continue to the read-only SQL query pack.

## Security Notes

- No secrets, tokens, connection strings, raw rows, customer data, object paths, or customer/order/device identifiers are recorded in this evidence file.
- `db dump --dry-run` output contained connection material and was redacted before review/recording.
- No row sampling was performed.
