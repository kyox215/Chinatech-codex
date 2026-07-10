# Shared DB Tenant Isolation Phase 5 Read-Only Live Verification Owner Approval Packet

Last updated: 2026-07-10
Owner: Hexiang Huang / 鹤祥
Status: targeted TASK-009 read-only verification completed; production database application is NO-GO pending legacy-table containment and recovery proof
Related runbook: `docs/SHARED_DB_TENANT_PHASE5_VERIFICATION_RUNBOOK.md`
Related query pack: `docs/SHARED_DB_TENANT_PHASE5_QUERY_PACK.md`

## Decision Required

Approve or decline Phase 5 read-only live verification for the shared-database tenant isolation rollout.

TASK-009 has now produced enough targeted live evidence to stop normal production apply:

- 17 public legacy tables have RLS disabled and direct `anon/authenticated` privileges; active tables may have unknown old-client consumers.
- The complete historical local migration chain is not reproducible from zero.
- No current full backup/PITR artifact plus isolated restore drill is recorded in this packet.
- The additive payment migration itself passed target-schema clone and pgTAP review, but that slice-level PASS does not override the environment-level NO-GO.

The next Owner decision is therefore not a generic "apply database" confirmation. It is either: remediate the Gate findings first, or explicitly approve a payment-only risk-reduction exception with exact migration hash, DB-first rollout order, backup/recovery risk acceptance, legacy-table containment owner/deadline, post-apply verification, and observation ownership.

2026-07-10 update: the Owner explicitly requested `main` push and database application. TASK-009 treated that as approval for the exact payment-only exception, applied only `20260710145642_order_payment_ledger_atomic_rpc.sql`, and verified that `anon/authenticated` have no direct ledger/RPC access. All broader database work remains under the NO-GO conditions above.

This approval is only for verification. It does not approve production migration, schema changes, data mutation, PostgREST schema-cache reload, Vercel deploy/promote, git push, customer communication, or Phase 6 rollout.

## Recommended Option

Option A: approve a bounded read-only verification window.

Use this when the Owner can confirm the target Supabase project, operator, backup evidence, and redaction rules. This allows the team to prove live database/RLS/storage parity before deciding whether any migration or release is safe.

## Alternatives

Option B: defer live verification.

Use this if target environment, backup/restore proof, or operator ownership is unclear. Local development can continue, but production-grade isolation cannot be claimed.

Option C: approve staging-only verification first.

Use this if production verification feels too risky. The same query pack can be run against a staging/preview Supabase target, but the result does not prove production parity.

## Approval Scope If Option A Is Approved

Allowed:

- Confirm CLI and target metadata without printing secrets.
- Run `supabase migration list --linked`.
- Run `supabase db push --linked --dry-run`.
- Run `supabase db dump --linked --dry-run`.
- Run the SQL blocks listed in `docs/SHARED_DB_TENANT_PHASE5_QUERY_PACK.md` inside a read-only transaction where supported.
- Record only counts, booleans, table names, policy names, constraint names, migration versions, and error codes.
- Run non-service RLS/Storage behavior smokes only with approved test identities and without exposing secrets or row contents.

Not allowed:

- `supabase db push` without `--dry-run`.
- Any `insert`, `update`, `delete`, `truncate`, `alter`, `create`, `drop`, `grant`, `revoke`, `notify pgrst`, `vacuum`, `reindex`, or policy/storage mutation.
- Any production backfill, deletion, anonymization, data move, or row sampling.
- Any schema-cache reload.
- Any Vercel deploy, promote, alias, rollback, or git push.
- Any Phase 6 global rollout.
- Sharing live customer PII, object paths, secrets, tokens, full row contents, or customer/device/order identifiers in chat, screenshots, task memory, or agent prompts.

## Required Owner Inputs

Before any live or linked Supabase command, record:

| Field | Required value |
|---|---|
| Target project ref |  |
| Target environment | production / staging / other |
| Operator |  |
| Approver | Hexiang Huang / 鹤祥 |
| Allowed CLI commands | migration list, db push dry-run, db dump dry-run |
| Allowed SQL scope | read-only query pack only |
| Runbook hash |  |
| Query pack hash |  |
| Approval packet hash |  |
| Production deployment target |  |
| Verification window |  |
| Backup artifact id |  |
| Backup timestamp |  |
| Restore-drill target |  |
| Restore-drill result |  |
| RPO/RTO estimate |  |
| Restore owner |  |
| Sign-off owner |  |
| Default-store rows expected? | yes / no / unknown |
| Offline-sync draft migrations excluded? | yes / no |
| `store_invite_link_attempts.actor_email` retention decision | keep temporarily / anonymize / migrate away / undecided |
| Evidence output path |  |
| Redaction reviewer |  |

## Operational Roles

| Role | Owner | Responsibility |
|---|---|---|
| Executor |  | Runs only approved read-only commands and records redacted summaries. |
| Owner approver | Hexiang Huang / 鹤祥 | Confirms scope and decides whether to continue after results. |
| Observer |  | Watches for unexpected app/API errors during verification. |
| Data reviewer |  | Reviews no-go counts and migration history. |
| Security reviewer |  | Reviews RLS/Storage behavior and sensitive-output handling. |
| Rollback/forward-fix lead |  | Prepares remediation package if no-go findings appear. |

## Evidence Rules

Store evidence outside chat when possible. Evidence may contain:

- Query pack version and hash.
- Target project ref and environment.
- Command names and pass/fail summaries.
- Count totals and boolean results.
- Constraint, policy, table, function, and migration names.
- Redacted error codes and short notes.

Evidence must not contain:

- Customer names, phones, emails, addresses, notes, messages, device identifiers, IMEI, photos, object paths with customer context, access tokens, service-role keys, anon keys, full URLs containing secrets, or raw rows.

## Hash Capture

Capture file hashes immediately before the approved execution window. Do not treat hashes embedded in old chat messages as authoritative.

```bash
shasum -a 256 docs/SHARED_DB_TENANT_PHASE5_VERIFICATION_RUNBOOK.md
shasum -a 256 docs/SHARED_DB_TENANT_PHASE5_QUERY_PACK.md
shasum -a 256 docs/SHARED_DB_TENANT_PHASE5_APPROVAL_PACKET.md
```

Record only the hashes and file names in the approval record. Do not record environment variables, connection strings, tokens, or command output that includes secrets.

## No-Go Result Handling

If any no-go threshold fails:

1. Stop after recording the count or boolean result.
2. Do not sample rows.
3. Create a remediation package with the failed check, impact, likely cause, and proposed fix.
4. Ask for separate Owner approval before any live or linked mutation, migration apply, schema-cache reload, backfill, anonymization, deployment, push, or Phase 6 action.

## Phase 6 Entry Gate

Phase 6 cannot start until:

- Phase 5 approved read-only checks pass, or every exception has an Owner-approved remediation plan.
- Non-service RLS/Storage smokes pass or are explicitly deferred with risk acceptance.
- Service-role repository bypass matrix is reviewed.
- Schema-cache visibility is proven.
- Private attachment storage and metadata checks pass.
- `actor_email` retention/anonymization decision is recorded.
- Security-definer/public-view checks pass or are approved as exceptions.
- A default-off feature flag or equivalent rollout gate is defined for risky global changes.

## Approval Record

```text
decision:
approved_option:
conditions:
target_project_ref:
target_environment:
production_deployment_target:
operator:
verification_window:
runbook_hash:
query_pack_hash:
approval_packet_hash:
backup_artifact_id:
backup_timestamp:
restore_drill_target:
restore_drill_result:
rpo_rto_estimate:
restore_owner:
sign_off_owner:
offline_sync_drafts_excluded:
actor_email_retention_decision:
evidence_output_path:
redaction_reviewer:
approved_by:
approved_at:
```
