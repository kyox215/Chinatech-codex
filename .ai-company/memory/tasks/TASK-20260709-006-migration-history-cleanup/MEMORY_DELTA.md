# Memory Delta — TASK-20260709-006-migration-history-cleanup

## Candidate project facts

- Supabase migration history cleanup 2026-07-09: remote-only version `20260708182631` was resolved by adding `supabase/migrations/20260708182631_store_invite_links.sql`. Source: `supabase migration list --linked`, `supabase migration fetch --linked`, task evidence E-003/E-004/E-010. Status: observed/current. Owner: DATA/Integration Lead. Review trigger: before future linked `supabase db push`.
- Remaining linked Supabase drift after cleanup is a 25-file local-only queue older than the latest remote migration. Source: `supabase db push --linked --dry-run` after cleanup. Status: unresolved by design. Owner: DATA/Integration Lead. Review trigger: before using `--include-all`, `migration repair`, or applying any old migration.

## Candidate department updates

- DATA: `supabase migration fetch --linked` can overwrite existing local migration files, not only add missing files. Use `git status` immediately after fetch and restore unintended tracked overwrites before proceeding. Source: task evidence E-004/E-005. Status: process warning.
- DATA/SEC: Fetched baseline `20260213234620_create_chinatechos_tables_v2.sql` contained destructive legacy DROP/CREATE SQL and must not replace the existing safe placeholder `20260213234620_remote_baseline.sql`. Source: task evidence E-006. Status: process warning.

## Candidate decisions / ADRs

- Decision: keep remote-applied invite-link version `20260708182631_store_invite_links.sql` and retain canonical local `20260704221944_store_invite_links.sql` for now. Do not mark `20260704221944` applied or delete it without a separate migration reconciliation decision. Source: task evidence E-007/E-010. Status: active decision.
- Decision: delete `supabase/migrations/20260707110000_repairdesk_offline_order_sync_rpc_draft 2.sql` because it was byte-identical to the canonical file and unreferenced. Source: task evidence E-008. Status: implemented.

## Candidate lessons and capability evidence

- Lesson: do not treat Supabase CLI fetch output as safe until the resulting file diff is inspected; CLI can produce both helpful missing migration files and unsafe duplicate baseline files in the same run.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
