# Shared DB Tenant Isolation Phase 5R Remediation Package

Last updated: 2026-07-07
Owner: Hexiang Huang / He Xiang
Status: remediation approval package prepared; no production action authorized
Related plan: `docs/SHARED_DB_TENANT_PHASE5R_MIGRATION_RECONCILIATION_PLAN.md`
Related task: `.ai-company/memory/tasks/TASK-20260707-001-shared-db-tenant-onboarding/`

## Purpose

This package defines the decision path after Phase 5R exhausted visible local/Git/archive/iCloud/Volumes/developer-cache/session recovery sources and the Owner-approved isolated `supabase db pull` review did not recover exact SQL.

It is an approval and review package only. It does not authorize `supabase db pull`, `supabase migration repair`, linked migration apply, production mutation, schema-cache reload, deploy, push, backfill, anonymization, the full live SQL query pack, or Phase 6.

## Current Evidence

The live linked preflight and isolated review agree on the same blocker: remote Supabase migration history contains seven versions with no exact local SQL file:

| Remote-only version | Current status |
|---|---|
| `20260611103402` | exact SQL missing |
| `20260611103627` | exact SQL missing |
| `20260611171345` | exact SQL missing |
| `20260613101014` | exact SQL missing |
| `20260619194103` | exact SQL missing |
| `20260621074627` | exact SQL missing |
| `20260701214123` | exact SQL missing |

The Owner-approved isolated review produced these results:

- Standard `supabase db pull` in `/private/tmp/repairdesk-phase5r-db-pull-20260707T1820Z` stopped before file generation because remote and local migration history still diverge.
- `supabase db pull --use-pg-delta` stopped before output with `permission denied for table pg_user_mapping` / SQLSTATE `42501`.
- No generated Phase 5R migration or declarative schema file exists.
- A schema-only public dump was captured at `/private/tmp/repairdesk-phase5r-db-pull-20260707T1820Z/phase5r_public_schema_dump.sql`.
- Dump SHA256: `738d76455d08c821d4c27808f93d87748fab588098d824127650b2e96a91f39b`.
- Dump scope: public schema shape only; no top-level `INSERT INTO` or `COPY` data export lines found.

The fallback schema dump is useful supporting evidence for live schema shape. It is not exact historical migration SQL, and it does not reconcile migration history.

## Non-Negotiable Invariants

- Do not use `supabase migration repair` to hide divergence.
- Do not claim candidate mappings are exact SQL unless the original SQL entity and provenance are recovered.
- Do not continue the full live SQL query pack while migration history remains unexplained. A remediation plan alone is not sufficient; continuation requires executed remediation, trusted history state, DATA/SEC/QA/RELEASE sign-off, and separate Owner approval for the specific read-only command set.
- Do not create placeholder migrations pretending to be original historical files.
- Do not run `supabase db pull`, linked apply, production mutation, schema-cache reload, deploy, push, backfill, anonymization, or Phase 6 from this package.
- Do not store raw customer rows, production PII, secrets, connection strings, tokens, Supabase Storage object keys/paths, customer-identifying file paths, or unredacted SQL output in chat, task memory, screenshots, or sub-agent prompts.
- Keep local offline draft migrations excluded unless separately approved:
  - `20260707090000_repairdesk_offline_operations.sql`
  - `20260707110000_repairdesk_offline_order_sync_rpc_draft.sql`

## Remediation Options

### Option A — Exact SQL Recovery

Status: preferred, but currently exhausted in visible local sources.

Use when another trusted source can provide the original migration files, such as an external disk, Time Machine, old machine, backup, deployment artifact, private remote branch, CI artifact, or old clone.

Required steps:

1. Recover each exact `supabase/migrations/<remote_version>_*.sql` file.
2. Record source class, redacted evidence location, retrieval time, SHA256, and reviewer.
3. Confirm the recovered filename/version matches the remote migration entry.
4. Re-run local migration checks in an isolated copy.
5. Request approval before linked `migration list`, `db push --dry-run`, or any full live query pack continuation.

Outcome:

- Best path for auditability.
- Preserves historical truth instead of reconstructing it.
- Can unblock Phase 5 after dry-run verification passes.

### Option B — Documented Reconstruction Package

Status: next recommended work if no new exact-SQL source exists.

Use when exact SQL cannot be recovered but the project needs a reviewed, honest way to explain and normalize migration history.

Required steps:

1. Create reconstructed migration files in an isolated branch/worktree or review directory only.
2. Use remote versions and path/name clues, but mark every file as reconstructed in comments and task evidence.
3. Use local candidate SQL and fallback schema dump clues as supporting input, not proof of equality.
4. Quarantine or classify differently timestamped local duplicate candidates.
5. Run local reset/apply verification only in an isolated local database.
6. Compare local reconstructed schema to the public schema dump object manifest.
7. Submit DATA, SEC, QA, and RELEASE read-only reviews before any linked CLI action, including future `supabase db pull`.

Outcome:

- Produces an auditable remediation proposal.
- Does not prove byte-for-byte historical SQL equality.
- Still requires explicit Owner approval before any `supabase db pull`, `migration repair`, linked dry-run, linked apply, or production release step.

### Option C — Metadata-Only Migration Repair Package

Status: high risk; not recommended as first choice.

Use only if exact SQL cannot be recovered, reconstruction is reviewed, the live schema state is proven, and the Owner explicitly approves a metadata repair runbook.

Important: `supabase migration repair` adjusts migration history records; it does not apply schema SQL and does not verify that the local files match what production originally ran.

Required safeguards:

1. Redacted before/after `supabase migration list --linked` evidence.
2. Backup artifact and restore proof recorded before execution.
3. Clear list of versions to mark `applied` or `reverted`.
4. Separate approval for every command.
5. Run only by the Integration Lead or approved operator.
6. Immediate post-repair dry-run and schema comparison.
7. Rollback/forward-fix plan if repair creates misleading pending migration state.

Outcome:

- Can align history metadata when schema truth is already proven.
- Can also create a false sense of safety if used to paper over unknown SQL.
- Must not be used as a shortcut.

### Option D — Freeze Phase 5 Production Verification

Status: safest if auditability is more important than schedule.

Use when exact SQL cannot be recovered and the Owner does not approve reconstruction or metadata repair.

Outcome:

- No further production risk.
- Phase 5 full live SQL verification and Phase 6 remain blocked.
- Local code can continue only in non-production paths that do not depend on production isolation claims.

## Recommended Path

Recommended next action: prepare Option B as a read-only reconstruction design package, not execution.

The design package should:

1. Re-state that Option A remains preferred if a new exact-SQL source appears.
2. Build a per-version reconstruction manifest using the candidate table below.
3. Classify local-only migrations before any linked dry-run.
4. Define local-only verification steps against an isolated database.
5. Require DATA, SEC, QA, and RELEASE review.
6. Return to the Owner for explicit approval before any remote metadata or schema action, including future `supabase db pull`.

## Candidate Mapping Manifest

These mappings are evidence clues only. They do not prove SQL equality.

| Remote-only version | Path/name clue | Local candidate | Candidate SHA256 | Evidence grade | Remediation classification |
|---|---|---|---|---|---|
| `20260611103402` | `repairdesk_remote_schema_compatibility` | `20260611102805_repairdesk_remote_schema_compatibility.sql` | `2fadd134337f135bab6501052df5c16a98bbd81e45936fdf1ea6a8f5f81b2c27` | session path/name clue plus local candidate hash | candidate reconstruction input |
| `20260611103627` | `repairdesk_message_template_legacy_sync` | `20260611103526_repairdesk_message_template_legacy_sync.sql` | `a2cabc480179a8eb795c393a285dc9c582f6f010d5994874dade96dc99b08587` | session path/name clue plus local candidate hash | candidate reconstruction input |
| `20260611171345` | `order_warranty_accessory_rules` | `20260611143348_order_warranty_accessory_rules.sql` | `baeb50d0f55dea84ec3cc9b5e002c4935becbc031472ea6072f73a62f001ee3d` | session path/name clue plus local candidate hash | high-risk candidate reconstruction input |
| `20260613101014` | `repairdesk_order_contract_compat` | `20260613113000_repairdesk_order_contract_compat.sql` | `5c83022344dbb43dfa694a7eb05910eed0da9bbb1243423ad50e9171b57ea34d` | session path/name clue plus local candidate hash | candidate reconstruction input |
| `20260619194103` | `repairdesk_attachment_storage_repair` | `20260619193655_repairdesk_attachment_storage_repair.sql` | `51b9871f6e978f9e6a798aa381014ed6939972c86bb52a3e2ef7d69873602f73` | historical production-name mapping plus local hash | candidate reconstruction input |
| `20260621074627` | `customer_interactions_store_id_repair` | `20260620120000_customer_interactions_store_id_repair.sql` | `98ffaf62dbb7b7cca4309ee0123fad24893353b3f261cf502c3ccf4945b0207b` | strong production-effect evidence plus local hash | candidate reconstruction input |
| `20260701214123` | `order_device_unlock_credentials` | `20260701120000_order_device_unlock_credentials.sql` | `3b4d953abf4b91a3f89032a9a30d4daba623cec08cbd762b7de77149410bcaca` | historical production-name mapping plus local hash | candidate reconstruction input |

## Local-Only Migration Handling

The failed isolated `db pull` output suggested repair commands for local-only versions. This package does not authorize those commands.

Every local-only version must be classified before any repair or linked dry-run:

- `represented_remote`: likely already represented in remote history under a different timestamp, but not yet proven.
- `intended_pending`: intended future production migration; requires normal approval and dry-run.
- `draft_excluded`: local draft that must stay out of production paths.
- `stale_local_only`: old local-only file that should not be applied and should be documented.
- `unknown`: no decision yet.

This table is a pre-dry-run classification queue, not an approved pending migration list. No linked dry-run may run until every `unknown` is resolved, every `represented_remote` candidate has evidence, and an expected pending migration list is reviewed. Unresolved owner defaults to the Integration Lead until the Owner classifies the migration or assigns a different owner.

| Local-only version | Local file clue | Initial classification |
|---|---|---|
| `20260610234427` | `buyback_resale_inventory` | unknown; classify before dry-run |
| `20260611001527` | `message_templates_settings` | unknown; classify before dry-run |
| `20260611002831` | `enterprise_multi_store_foundation` | unknown; classify before dry-run |
| `20260611005916` | `harden_store_tenant_constraints` | unknown; classify before dry-run |
| `20260611102805` | `repairdesk_remote_schema_compatibility` | candidate `represented_remote` for `20260611103402` |
| `20260611103526` | `repairdesk_message_template_legacy_sync` | candidate `represented_remote` for `20260611103627` |
| `20260611143348` | `order_warranty_accessory_rules` | candidate for `20260611171345`; special ambiguity because it was not in the recorded local-only repair queue and may already be represented remotely under its own version |
| `20260611125512` | `customer_list_performance` | unknown; classify before dry-run |
| `20260611202504` | `repairdesk_canonical_order_status` | unknown; classify before dry-run |
| `20260613113000` | `repairdesk_order_contract_compat` | candidate `represented_remote` for `20260613101014` |
| `20260613122452` | `order_attachments` | unknown; classify before dry-run |
| `20260617143000` | `inventory_attachments` | unknown; classify before dry-run |
| `20260618171500` | `order_approval_parts_transition` | unknown; classify before dry-run |
| `20260618172000` | `repaired_workflow_status_repair` | unknown; classify before dry-run |
| `20260619103000` | `order_external_repair_workflow` | unknown; classify before dry-run |
| `20260619193655` | `repairdesk_attachment_storage_repair` | candidate `represented_remote` for `20260619194103` |
| `20260620120000` | `customer_interactions_store_id_repair` | candidate `represented_remote` for `20260621074627` |
| `20260701120000` | `order_device_unlock_credentials` | candidate `represented_remote` for `20260701214123` |
| `20260704190000` | `private_store_onboarding_requests` | unknown; classify before dry-run |
| `20260704203000` | `onboarding_owner_email_routing_hardening` | unknown; classify before dry-run |
| `20260704212000` | `onboarding_approved_role_and_cancel` | unknown; classify before dry-run |
| `20260704220843` | `store_invitations_non_owner_role` | unknown; classify before dry-run |
| `20260704221944` | `store_invite_links` | potential forward migration; live schema dump did not contain `store_invite_links` |
| `20260706133632` | `repairdesk_realtime_private_broadcast_authorization` | unknown; classify before dry-run |

## `store_invite_links` Risk

The fallback public schema dump did not contain `store_invite_links`, while local migration `20260704221944_store_invite_links.sql` exists and appears local-only.

Implications:

- Any invite-link feature depending on `store_invite_links` cannot be assumed production-ready.
- This may require a future forward migration if the feature is intended for production.
- It must not be silently repaired into history unless the schema object actually exists or a reviewed forward migration is approved.

## Validation Plan For Option B

Run this only in an isolated local context until the Owner separately approves remote actions.

1. Create an isolated branch/worktree or review directory.
2. Copy current migrations minus excluded drafts.
3. Add reconstructed files under remote-version names with explicit reconstruction comments.
4. Preserve original local candidate files or move them only inside the isolated review package; do not mutate production history in the main worktree without approval.
5. Build a manifest with:
   - remote version,
   - reconstructed filename,
   - source candidate,
   - source hashes,
   - schema objects affected,
   - known differences,
   - reviewer sign-off.
6. Run local Supabase migration reset/apply in an isolated local database.
7. Generate a local schema dump/object manifest.
8. Compare object names, columns, constraints, indexes, policies, functions, triggers, and grants against the Phase 5R public schema dump.
9. Confirm no data rows, secrets, raw PII, Supabase Storage object keys/paths, customer-identifying file paths, or production credentials are included in evidence.
10. Re-run static docs checks and secret scans.
11. Request Owner approval before any linked `migration list`, `db pull`, `db push --dry-run`, `db dump --dry-run`, `migration repair`, linked apply, or live SQL query pack continuation.

## Review Gates

Before any remote step, require:

| Gate | Required conclusion |
|---|---|
| DATA | reconstructed/local-only classification is coherent; no candidate is presented as exact SQL |
| SEC | no PII/secret leakage; tenant isolation and RLS/storage verification remains blocked until history state is trustworthy |
| QA | acceptance criteria map to evidence; no skipped high-risk check is hidden |
| RELEASE | rollback, backup/restore proof, operator, timing, and no-go actions are explicit |
| Owner | chooses Option A, B, C, or D and separately approves any remote command |

## Approval Checklist

The Owner must explicitly choose:

- Path: Option A exact SQL recovery, Option B documented reconstruction, Option C metadata repair, or Option D freeze.
- Whether reconstructed local files may be created in an isolated review branch/worktree.
- Whether any `supabase migration repair` command is allowed. Default: no.
- Whether local-only migrations are intended pending production changes, represented remotely, stale, or draft-excluded.
- Whether `store_invite_links` should become a forward migration candidate.
- Backup artifact location, backup timestamp, restore proof method, restore owner, RPO/RTO target, operator, redaction reviewer, target Supabase ref/environment, maintenance window, and redacted evidence path.

## Ready To Ask Owner For A/B/C/D Decision

The package is ready to ask the Owner to choose a remediation path when:

- Every remote-only version has a documented status.
- Local-only unresolved items are visible, with Integration Lead as default owner until Owner classification.
- The fallback schema dump is used only as supporting schema-shape evidence.
- The package contains no raw production data, PII, secrets, unredacted Supabase Storage object keys/paths, or customer-identifying file paths.
- DATA, SEC, and QA reviews have returned PASS or documented CONDITIONAL findings.
- No-go actions and unresolved items are visible.

## Ready For Remote Or Linked Action

The package is ready for any remote or linked action only when:

- The Owner has chosen Option A, B, C, or D.
- Every local-only migration has a resolved classification or a documented exception.
- Every `represented_remote` candidate has evidence and reviewer sign-off.
- RELEASE review is complete.
- Backup/restore proof, operator, target ref/environment, maintenance window, RPO/RTO, and redaction reviewer are recorded.
- The specific command or action is separately approved by the Owner.
