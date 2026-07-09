# Shared DB Tenant Isolation Phase 5R Migration History Reconciliation Plan

Last updated: 2026-07-10
Owner: Hexiang Huang / 鹤祥
Status: migration-history alignment rechecked as resolved; full live SQL query pack still requires normal Database Application Gate approval
Related evidence: `.ai-company/memory/tasks/TASK-20260707-001-shared-db-tenant-onboarding/PHASE5_LIVE_PREFLIGHT_20260707T135039Z.md`
Related runbook: `docs/SHARED_DB_TENANT_PHASE5_VERIFICATION_RUNBOOK.md`
Related query pack: `docs/SHARED_DB_TENANT_PHASE5_QUERY_PACK.md`
Related remediation package: `docs/SHARED_DB_TENANT_PHASE5R_REMEDIATION_PACKAGE.md`

## Purpose

Phase 5R reconciles Supabase migration history before Phase 5 full live SQL verification continues. A remediation plan by itself does not reopen live verification; continuation requires executed remediation, trusted history state, DATA/SEC/QA/RELEASE sign-off, and separate Owner approval for the specific read-only command set.

This phase does not design new schema. It makes the local migration history and remote migration history explainable enough that `supabase migration list --linked` and `supabase db push --linked --dry-run` can be trusted as release gates.

## 2026-07-10 Recheck Result

Status: current CLI evidence supersedes the old blocker.

- `supabase migration list --linked` now shows every local migration version aligned with the remote history through `20260709235000`.
- `supabase db push --linked --dry-run --include-all` reports `Remote database is up to date`.
- Linked migration history contains 48 versions; latest version is `20260709235000`.
- No `supabase migration repair`, `supabase db pull`, linked apply, production DDL, data mutation, schema-cache reload, deploy, or push was run as part of this recheck.

Impact:

- The historical remote-only/local-only mismatch is no longer the active Phase 5R blocker.
- The historical investigation below remains useful audit background, but it should not be treated as current migration-list state after the 2026-07-10 recheck.
- Full live SQL verification and any production apply still require the normal Database Application Gate, current dry-run evidence, backup/restore proof, DATA/SEC/QA/RELEASE review, and owner approval for the exact command set.

## Current Blocker

Historical state before 2026-07-10: owner-approved linked CLI preflight stopped before the full live SQL query pack because the remote migration history contained versions that were not present as local migration files:

| Remote-only version | Current local status | Handling |
|---|---|---|
| `20260611103402` | no exact local file or history path found; non-portable local session evidence suggests name `repairdesk_remote_schema_compatibility`; local candidate is `20260611102805_repairdesk_remote_schema_compatibility.sql` | candidate mapping only; needs exact SQL recovery or approved isolated pull/diff review |
| `20260611103627` | no exact local file or history path found; non-portable local session evidence suggests name `repairdesk_message_template_legacy_sync`; local candidate is `20260611103526_repairdesk_message_template_legacy_sync.sql` | candidate mapping only; needs exact SQL recovery or approved isolated pull/diff review |
| `20260611171345` | no exact local file or history path found; non-portable local session evidence suggests name `order_warranty_accessory_rules`; local candidate is `20260611143348_order_warranty_accessory_rules.sql` | higher-risk candidate because the remote history also has nearby order/workflow entries; needs exact SQL recovery or approved isolated pull/diff review |
| `20260613101014` | no exact local file or history path found; non-portable local session evidence suggests name `repairdesk_order_contract_compat`; local candidate is `20260613113000_repairdesk_order_contract_compat.sql` | candidate mapping only; needs exact SQL recovery or approved isolated pull/diff review |
| `20260619194103` | no exact local file; historical task evidence maps remote entry name to local `20260619193655_repairdesk_attachment_storage_repair.sql` | prepare candidate mapping only; do not claim SQL equality without proof |
| `20260621074627` | no exact local file; historical task evidence maps remote entry name to local `20260620120000_customer_interactions_store_id_repair.sql` | prepare candidate mapping only; do not claim SQL equality without proof |
| `20260701214123` | no exact local file; historical task evidence maps remote entry name to local `20260701120000_order_device_unlock_credentials.sql` | prepare candidate mapping only; do not claim SQL equality without proof |

Local read-only investigation found no exact filename or historical migration path for the seven versions in the current worktree and local Git object set. After `git fetch --all --prune`, the refreshed local remote refs still contained no exact filename or historical migration path for the seven versions.

Extended read-only evidence search also found no exact SQL recovery source:

- GitHub remote heads/tags expose only `main` and `codex/repairdesk-enterprise-multistore`; no tags were available.
- GitHub PR head refs returned no refs.
- All reachable commits contain only task evidence for the remote-only versions, not the missing SQL files.
- `git stash list` is empty.
- Reflog confirms the known `main` and `codex/repairdesk-enterprise-multistore` history but does not expose an exact missing migration file.
- Unreachable Git blobs contain references to local differently timestamped migrations, run evidence, or application error copy; no unreachable blob inspected so far contains exact SQL for the seven remote-only migration filenames.
- Local non-Supabase archive search across visible `Documents`, `Downloads`, and `Desktop` sources, local clones, and zip/tar archive indexes/text found no exact SQL migration file or exact archive path for the seven remote-only versions.

`/Users/kyox215/Downloads/Chinatech-codex-main.zip` is the only newly useful local archive clue found so far: it contains RepairDesk 202606/202607 migration files and task memory mentioning `20260701214123` as `order_device_unlock_credentials`, but the actual SQL file in that evidence set remains `20260701120000_order_device_unlock_credentials.sql`. This is a candidate mapping only, not exact SQL evidence.

Additional visible local-source recovery on 2026-07-07 checked exact filename/content hits under `Documents`, local Git directories and adjacent clones, the old `ChinatechOS-2026` repository, `Downloads/repairdesk-full-export`, old Desktop Supabase migration folders, home-directory exact filename searches, candidate-name searches, and task/global memory summaries. This added candidate-name evidence, but still found no exact remote-version SQL file for any of the seven remote-only versions.

Extended visible-source recovery also checked visible iCloud (`/Users/kyox215/Library/Mobile Documents`), `/Volumes`, common developer backup/cache paths, and `.codex` sessions/memories. No exact SQL entity was found. `/Volumes` exposed no external disk or Time Machine volume beyond `Macintosh HD -> /`. `.codex` sessions provide exact remote-version path/name clues, but those are session transcript evidence only and cannot be hashed as migration SQL:

| Remote-only version | Session-transcript path/name clue | Current classification |
|---|---|---|
| `20260611103402` | `supabase/migrations/20260611103402_repairdesk_remote_schema_compatibility.sql` | name clue only; no SQL entity found |
| `20260611103627` | `supabase/migrations/20260611103627_repairdesk_message_template_legacy_sync.sql` | name clue only; no SQL entity found |
| `20260611171345` | `supabase/migrations/20260611171345_order_warranty_accessory_rules.sql` | name clue only; no SQL entity found |
| `20260613101014` | `supabase/migrations/20260613101014_repairdesk_order_contract_compat.sql` | name clue only; no SQL entity found |
| `20260619194103` | `supabase/migrations/20260619194103_repairdesk_attachment_storage_repair.sql` | name clue only; no SQL entity found |
| `20260621074627` | `supabase/migrations/20260621074627_customer_interactions_store_id_repair.sql` | name clue only; no SQL entity found |
| `20260701214123` | `supabase/migrations/20260701214123_order_device_unlock_credentials.sql` | name clue only; no SQL entity found |

Candidate mapping sources:

- `20260611103402` -> `repairdesk_remote_schema_compatibility`: non-portable local session evidence; candidate local file `supabase/migrations/20260611102805_repairdesk_remote_schema_compatibility.sql`
- `20260611103627` -> `repairdesk_message_template_legacy_sync`: non-portable local session evidence; candidate local file `supabase/migrations/20260611103526_repairdesk_message_template_legacy_sync.sql`
- `20260611171345` -> `order_warranty_accessory_rules`: non-portable local session evidence; candidate local file `supabase/migrations/20260611143348_order_warranty_accessory_rules.sql`
- `20260613101014` -> `repairdesk_order_contract_compat`: non-portable local session evidence; candidate local file `supabase/migrations/20260613113000_repairdesk_order_contract_compat.sql`
- `20260619194103` -> `repairdesk_attachment_storage_repair`: `.ai-company/memory/tasks/TASK-20260619-195819-repairdesk-attachment-storage-upload-repai/EVIDENCE.md`
- `20260621074627` -> `customer_interactions_store_id_repair`: `.ai-company/memory/tasks/TASK-20260620-1200-customer-interactions-store-id/EVIDENCE.md` and local rollout summary evidence
- `20260701214123` -> `order_device_unlock_credentials`: `.ai-company/memory/tasks/TASK-20260701-002-order-device-unlock/EVIDENCE.md`

These sources are candidate evidence only. They do not prove byte-for-byte SQL equality with the production-applied migration entries. Some historical task evidence contains pre-apply notes that were superseded later in the same task timeline; Phase 5R uses those files only as name/version clues, not as exact migration provenance.

Notable local archive candidates and hashes:

| Candidate | SHA256 | Current classification |
|---|---|---|
| `20260611102805_repairdesk_remote_schema_compatibility.sql` | `2fadd134337f135bab6501052df5c16a98bbd81e45936fdf1ea6a8f5f81b2c27` | candidate mapping only; remote version differs |
| `20260611103526_repairdesk_message_template_legacy_sync.sql` | `a2cabc480179a8eb795c393a285dc9c582f6f010d5994874dade96dc99b08587` | candidate mapping only; remote version differs |
| `20260611143348_order_warranty_accessory_rules.sql` | `baeb50d0f55dea84ec3cc9b5e002c4935becbc031472ea6072f73a62f001ee3d` | higher-risk candidate mapping only; remote version differs |
| `20260613113000_repairdesk_order_contract_compat.sql` | `5c83022344dbb43dfa694a7eb05910eed0da9bbb1243423ad50e9171b57ea34d` | candidate mapping only; remote version differs |
| `20260619193655_repairdesk_attachment_storage_repair.sql` | `51b9871f6e978f9e6a798aa381014ed6939972c86bb52a3e2ef7d69873602f73` | historical production-name mapping only; remote version differs |
| `20260620120000_customer_interactions_store_id_repair.sql` | `98ffaf62dbb7b7cca4309ee0123fad24893353b3f261cf502c3ccf4945b0207b` | strong production-effect evidence, but still not SQL equality proof |
| `20260701120000_order_device_unlock_credentials.sql` | `3b4d953abf4b91a3f89032a9a30d4daba623cec08cbd762b7de77149410bcaca` | historical production-name mapping only; remote version differs |

Notable `.codex` evidence containers with path/name clues:

| Evidence container | SHA256 | Current classification |
|---|---|---|
| `/Users/kyox215/.codex/sessions/2026/07/02/rollout-2026-07-02T23-17-32-019f24b1-af0b-7573-87e2-9555b4c647ce.jsonl` | `d8771c0f030ec200e9fd676c4b9c61beea70920ba62c2c2166df7a710aa5b435` | session evidence only; not SQL text |
| `/Users/kyox215/.codex/sessions/2026/07/03/rollout-2026-07-03T01-38-48-019f2533-03f5-7640-aa21-e3bdebd32e48.jsonl` | `721e4e2fcccdf0484613f0218cd0aec7f692713d06fa660b9bdb9920cdd88793` | session evidence only; not SQL text |
| `/Users/kyox215/.codex/memories/rollout_summaries/2026-06-30T23-01-37-uCIK-repairdesk_order_device_unlock_and_migration_application.md` | `a6eb666efd7030782e50926f94a8f720bd5fff2b08662b30bd3170436552db82` | memory evidence only; not SQL text |
| `/Users/kyox215/.codex/memories/rollout_summaries/2026-06-20T10-01-50-YS9A-customer_interactions_store_id_repair_production_fix.md` | `6e7eeffffdd2ddddf816b899e057c4b125cfbe37a084b4c5bcd080aeae466ffa` | memory evidence only; not SQL text |

## Approved Isolated Pull Review

Owner approved an isolated `supabase db pull` review on 2026-07-07. The review ran only from `/private/tmp/repairdesk-phase5r-db-pull-20260707T1820Z`, with the two local offline draft migrations excluded from the isolated copy:

- `20260707090000_repairdesk_offline_operations.sql`
- `20260707110000_repairdesk_offline_order_sync_rpc_draft.sql`

Results:

- `supabase db pull phase5r_isolated_remote_schema_review --linked --schema public` did not generate a migration file. The CLI stopped because remote migration history still does not match local migration files and again surfaced the seven remote-only versions.
- `supabase db pull phase5r_isolated_remote_schema_review_pg_delta --linked --schema public --use-pg-delta` did not generate a declarative schema export. It failed during pg-delta catalog extraction with `permission denied for table pg_user_mapping`.
- No `supabase migration repair`, linked migration apply, production mutation, history update, schema-cache reload, deploy, push, backfill, anonymization, or Phase 6 action was performed.

Fallback isolated artifact:

| Artifact | SHA256 | Lines / bytes | Current classification |
|---|---|---:|---|
| `/private/tmp/repairdesk-phase5r-db-pull-20260707T1820Z/phase5r_public_schema_dump.sql` | `738d76455d08c821d4c27808f93d87748fab588098d824127650b2e96a91f39b` | 3976 / 132432 | schema-only public snapshot; useful for review, not migration-history reconciliation |

Snapshot observations:

- No top-level `INSERT INTO` or `COPY` data export was found; the only `INSERT` hit is inside a function body.
- No obvious connection string, PAT, JWT, private key, or service credential was found by the targeted secret scan; `token_hash` appears as a schema field.
- Public schema contains `customer_interactions`, `inventory_attachments`, `onboarding_requests`, `order_attachments`, `repair_orders`, and `store_invitations`.
- Public schema contains `customer_interactions_store_customer_created_idx`, order device unlock fields/check constraints, and attachment bucket check constraints.
- Public schema did not contain `store_invite_links`.
- Public schema did not contain the excluded offline draft keywords.

This fallback artifact helps classify live schema shape, but it does not recover exact historical SQL and does not unblock Phase 5 full live SQL verification.

## Remediation Package Prepared

A separate approval package now defines the next decision paths after exact SQL recovery and isolated `db pull` were exhausted:

- `docs/SHARED_DB_TENANT_PHASE5R_REMEDIATION_PACKAGE.md`

The remediation package keeps Option A exact SQL recovery as the preferred path if a new trusted source is supplied, but it also defines a controlled Option B documented reconstruction design path. It explicitly does not authorize `supabase db pull`, `supabase migration repair`, linked apply, production mutation, schema-cache reload, deploy, push, full live SQL query pack continuation, or Phase 6.

It also records the current local-only migration handling queue. In particular, `20260704221944_store_invite_links.sql` requires explicit classification because the fallback public schema dump did not contain `store_invite_links`.

## Hard Boundaries

Do not run without separate explicit Owner approval:

- `supabase migration repair`
- `supabase db pull`
- linked migration apply
- schema-cache reload
- Vercel deploy, promote, alias, or rollback
- git push
- production data mutation, backfill, delete, move, or anonymization
- full live SQL query pack continuation
- Phase 6 rollout

Do not record customer PII, raw rows, Supabase Storage object keys/paths, customer-identifying file paths, tokens, connection strings, or secrets in chat, task memory, screenshots, or sub-agent prompts.

## Local Draft Exclusions

These local migrations remain excluded from production/link dry-run apply paths unless separately approved:

| Migration | Reason |
|---|---|
| `20260707090000_repairdesk_offline_operations.sql` | local approval draft |
| `20260707110000_repairdesk_offline_order_sync_rpc_draft.sql` | local approval draft; contains `security definer` RPCs |

## Phase 5R Work Plan

### R0 — Freeze And Preserve Evidence

Status: done for the current checkpoint.

- Keep the full live SQL query pack stopped.
- Preserve the redacted CLI preflight evidence.
- Keep the current runbook/query/approval package hashes as evidence, but recapture hashes before any future approved execution window.

### R1 — Local Recovery Inventory

Status: done after refreshed local remote refs, reachable history, stash/reflog, unreachable blob keyword scan, and visible local archive/source search; can be rerun after new branches, backups, iCloud archives, external disks, Time Machine, old machines, or artifacts are added.

- Search current worktree and local Git history for exact migration filenames.
- Refresh Git remote refs and repeat the local history search.
- Check remote heads/tags and PR refs.
- Search all reachable commits for the seven versions.
- Check stash, reflog, and unreachable blob keyword hits.
- Search visible local non-Supabase archives and adjacent local clones.
- Search task memory and evidence for remote entry names.
- Classify every remote-only version as exact recovered, candidate-mapped, or unknown.

### R2 — Owner Decision Gate

Required before any remote/schema action:

1. Decide whether to recover exact SQL from another trusted source first, such as iCloud archives, an external disk, Time Machine, an old machine, a backup, deployment artifact, or GitHub source not available through current refs.
2. Decide whether to approve an isolated `supabase db pull` review branch/worktree if exact SQL cannot be recovered.
3. Confirm that `migration repair` remains no-go unless a separate repair package is prepared.
4. Confirm offline draft migrations remain excluded.

Recommended default: recover exact SQL first. Use `db pull` only as an isolated schema-diff review fallback, because it cannot prove historical migration SQL equality.

### R3 — Recovery Or Isolated Pull

Only after R2 approval:

- Exact recovery path:
  - restore files under `supabase/migrations/` with the remote version number and original SQL.
  - record source, hash, and provenance for every file.
- Isolated pull path:
  - use a separate review branch/worktree or evidence directory.
  - do not merge generated diff automatically.
  - classify generated schema differences as history reconstruction evidence, not as production-ready migration text.

### R4 — Local-Only Classification

Before rerunning linked dry-run:

- Classify every local-only migration as intended production, already represented remotely under a different version, or draft/excluded.
- Keep offline drafts excluded.
- Produce an expected pending migration list for the next dry-run.

### R5 — Approved Linked Dry-Run Recheck

Only after Owner approval of the reconciliation manifest:

- rerun `supabase migration list --linked`.
- rerun `supabase db push --linked --dry-run`.
- rerun `supabase db dump --linked --dry-run`.
- record only redacted summaries, counts, booleans, object names, versions, and error codes.

### R6 — Return To Phase 5 Query Pack

Continue to the full live read-only SQL query pack only if:

- no unexplained remote-only migration mismatch remains.
- offline drafts are absent from pending apply paths.
- pending migration list contains only Owner-approved production candidates.
- dry-run contains no destructive or unapproved changes.
- backup/restore proof and evidence redaction roles remain recorded.

## Acceptance Criteria

- Every remote-only version has a documented resolution status.
- Any candidate mapping is labeled as non-equivalent until SQL equality is proven.
- The first four unknown remote-only versions are not guessed or replaced with placeholder migrations.
- `migration repair` is not used as a shortcut to hide history divergence.
- `db pull`, if approved, runs only in an isolated review context and does not become an automatic migration.
- Full live SQL verification remains gated until the current aligned migration-history baseline is paired with an approved live SQL query-pack run, DATA/SEC/QA/RELEASE review, and separate Owner approval for the specific read-only command set.

## Next Owner Choice

Recommended: Option A if a new exact-SQL source can be supplied; otherwise prepare Option B as a read-only documented reconstruction design package.

| Option | Meaning | Result |
|---|---|---|
| A | Continue exact SQL recovery from a new trusted source | best auditability; needs external source not visible in this environment |
| B | Prepare documented reconstruction design in an isolated review context | practical next package; still does not prove historical SQL equality |
| C | Prepare metadata-only `migration repair` approval package | high risk; not recommended before reconstruction and review |
| D | Stop Phase 5 production verification for now | safest operationally; production isolation cannot be claimed complete |
