---
schema_version: 1
task_id: "TASK-20260709-006-migration-history-cleanup"
title: "Repair migration history cleanup notes"
status: "conditional"
task_class: "T1"
risk_level: "R3"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["DATA", "DOC", "QA", "SEC"]
created_at: "2026-07-09T00:31:14Z"
updated_at: "2026-07-09T00:33:42Z"
closed_at: "2026-07-09T00:33:42Z"
---
# Task — Repair migration history cleanup notes

## Owner request

Repair migration history cleanup notes

## Business value

Reduce Supabase migration history drift risk after customer kiosk migration application and keep future db push operations from being blocked by known local hygiene issues.

## Scope in

- Continue cleanup from the kiosk migration closeout notes.
- Remove stale/generated active-context duplicate files that pollute `git status`.
- Reconcile the specific remote-only Supabase migration version `20260708182631` by adding the missing local migration file.
- Remove the byte-identical duplicate local migration file with suffix ` 2.sql`.
- Verify the remaining migration history state with `supabase migration list --linked` and `supabase db push --linked --dry-run`.
- Record unresolved local-only migration drift without batch-repairing production history.

## Scope out

- Applying the 25 remaining local-only migrations to production.
- Batch `supabase migration repair --status applied` for old local-only versions.
- Changing existing canonical migration SQL content beyond removing the proven duplicate file.
- UI/API/kiosk feature behavior changes.
- Production schema changes; this task is migration-history hygiene only.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [ ] Remote-only 20260708182631 is represented locally without overwriting existing canonical migrations.
- [ ] Duplicate local migration file with suffix 2 is removed after proving it is byte-identical to the canonical file.
- [ ] Remaining local-only migrations are documented as unresolved and not batch-repaired without per-version proof.
- [ ] Workspace diff is validated, checkpointed, committed, and pushed to main.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Owner asked to continue fixing the attention points from the prior migration closeout | observed | chat request: "继续修复注意点" | in scope |
| Remote migration version `20260708182631` existed without a local file before this task | observed | `supabase migration list --linked` before fetch | fixed locally by adding `20260708182631_store_invite_links.sql` |
| `supabase migration fetch --linked` attempted to overwrite existing migration files | observed | `git status` after fetch showed 16 tracked migration modifications | reverted tracked overwrites with `git restore -- supabase/migrations` |
| Fetched baseline `20260213234620_create_chinatechos_tables_v2.sql` is unsafe to keep | observed | file contained DROP/CREATE legacy tables; local `20260213234620_remote_baseline.sql` already represents that version | deleted the fetched duplicate baseline |
| `20260707110000_repairdesk_offline_order_sync_rpc_draft 2.sql` was byte-identical to the canonical file | observed | `diff -u` returned no differences | deleted duplicate tracked file |
| Remaining migration drift is a 25-file local-only queue | observed | `supabase db push --linked --dry-run` after cleanup | unresolved; requires separate per-version production schema reconciliation |

## Decision and approval points

- Decision: keep `20260708182631_store_invite_links.sql` because it represents the remote-applied invite-link migration version.
- Decision: do not keep fetched `20260213234620_create_chinatechos_tables_v2.sql`; it duplicates the baseline version and contains destructive legacy SQL.
- Decision: delete only the byte-identical ` 2.sql` duplicate; do not delete or rewrite canonical migration files.
- Approval boundary: any future repair/apply of the 25 remaining local-only migrations requires explicit per-version evidence and Owner approval.

## Work packages

- WP-01 Read current repo/task state and classify risk.
- WP-02 Fetch missing remote migration file, revert unsafe CLI overwrites, and inspect new files.
- WP-03 Remove proven duplicate local migration file.
- WP-04 Verify with linked migration list, dry-run, schema existence query, diff checks, checkpoint, commit, push.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.

## Agent Plan

- Main thread only. No sub-agent spawned because the available sub-agent tool requires explicit user authorization, and this cleanup is a narrow sequential task with one writer and production-history approval boundaries.
