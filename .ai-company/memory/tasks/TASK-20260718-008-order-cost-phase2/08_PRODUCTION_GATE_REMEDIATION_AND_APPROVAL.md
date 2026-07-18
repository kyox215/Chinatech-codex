# Stage 08 — Production Gate Remediation and Owner Approval

Status: Option B approved — 2026-07-18T15:26:29Z

## Owner decision

The Owner replied `B` in the main task thread on 2026-07-18. This selects the written bounded
release exception below and explicitly accepts, for this release only, the absence of a proven
physical-backup restore/RPO/RTO and the pre-existing full-history migration replay failure.

This approval does not authorize destructive SQL, production historical-cost backfill, feature
flag activation, unrelated migrations, force pushing, customer communication, or any change to
the recovery baseline. All six Phase 2 child flags remain off during the release, and every remote
write remains subject to the fresh stop conditions in this packet.

The main Integration Lead acquired the shared local atomic release lock at
`/private/tmp/repairdesk-production-release-xluzcoduqsdvjoouqhkc.lock`. The primary checkout is
owned by a separate active task and will not be modified; release work remains in the isolated
Phase 2 worktree.

## Objective

Close the remaining recovery decision without weakening the verified Phase 2 migration, security,
or release contracts. This stage does not apply production migrations, copy customer data, change
feature flags, push Git, or deploy Vercel.

## Verified state

- Candidate `c731e0fbab70743cf0002b6b7a25101facd0d6de` is eight commits ahead and zero
  behind `origin/main@51d5b3b9648e77b355bb5635edf8df4c431eeb74`; the isolated worktree is clean.
- Linked history has Phase 1 applied and exactly the six reviewed Phase 2 migrations pending.
- Exact linked dry-run selects only versions `20260718122000`, `20260718123000`,
  `20260718124000`, `20260718130000`, `20260718133000`, and `20260718140000`.
- A fresh CLI schema-only dump of the current production database contains no `COPY`, `INSERT
  INTO`, or `\\copy` data statements. The 525,624-byte artifact has SHA-256
  `d4c92764e7dc517b14b4c23929cf7e731289d41110c457086c8cd6dccd730764` and remains
  outside the repository under `/private/tmp`.
- That current schema restored successfully into fresh PostgreSQL 17 database
  `repairdesk_cost_phase2_current_schema_20260718_g`. All six migrations then applied in order
  with `ON_ERROR_STOP=1`.
- Post-replay assertions passed: 11/11 Phase 2 tables exist and have RLS, browser table grants are
  zero, service-role SELECT coverage is 11/11, browser execution grants across 21 Phase 2 RPC
  overloads are zero, every security-definer RPC has an empty `search_path`, the profit view uses
  `security_invoker=true`, and no Phase 2 constraint is unvalidated.
- Production volume was read as counts only: 6,326 repair orders, 15 Phase 1 cost lines, zero cost
  defaults, 23 suppliers and five inventory items. No row contents or customer PII were exported.
- The 17 legacy RLS-disabled tables currently have zero anon/authenticated table grants. Likewise,
  the permissive policies on `orders`, `repair_quotes`, and `suppliers` currently have no browser
  grants, so the earlier claim of a direct browser bypass is stale. RLS defense-in-depth debt
  remains, and `recycling_models` showed recent database activity, so consumer discovery is still
  required before changing legacy objects.

## Remaining hard decision

The current-schema replay proves that the six Phase 2 migrations are compatible with the live
schema. It does not prove that a physical backup containing production data can be restored. The
linked project reports eight completed physical backups, latest
`2026-07-18T06:49:11.673Z`, but PITR is disabled and no isolated data-restore artifact, RPO/RTO,
restore owner, or sign-off exists.

The repository-wide clean migration replay also still fails before TASK-008 at
`20260611102805_repairdesk_remote_schema_compatibility.sql`. This is now classified as a broad
recovery-baseline debt rather than a Phase 2 current-schema compatibility failure. Project policy
still requires either remediation or a written Owner exception before a linked production write.

## Approval request

Decision required: choose one release path.

### Option A — Isolated full restore drill (recommended)

- Authorize an isolated Supabase restore target and the temporary handling of encrypted production
  backup data by the single release operator.
- Record target, artifact identifier, retention, redaction reviewer, restore owner, RPO/RTO and
  sign-off; validate counts/metadata only and delete the isolated environment under a separately
  approved cleanup action.
- Benefit: closes the real recovery gate instead of accepting it.
- Cost/risk: may require a paid Supabase project or support workflow and temporarily copies
  production data into an isolated controlled environment.

### Option B — Written bounded release exception

- Owner explicitly accepts the untested physical-restore and full-history replay risks for this
  release only.
- Release remains migration-first, additive, forward-fix based and default-off. No historical
  backfill runs automatically and no Phase 2 child flag is enabled during deployment.
- The current-schema replay, exact linked dry-run, completed physical backup visibility, immediate
  pre/post metadata checks and serialized single release operator become the bounded evidence.
- Benefit: allows the reviewed release to proceed without copying production data.
- Residual risk: a severe database failure may require Supabase support and has no proven RPO/RTO.

### Option C — Keep production unchanged

- Leave the branch, six pending migrations and all child flags unchanged/off.
- Open a separate P0 recovery-baseline project and resume only after it closes.

Recorded decision: **Option B / bounded release exception**.

## Exact release command set after approval

The operator must refresh remote state immediately before execution. The approved write set is
limited to:

1. `supabase db push --linked --dry-run` and assert the same six files only.
2. `supabase db push --linked` without `--include-all`.
3. Re-read migration history and run prepared table/index/RLS/ACL/RPC assertions.
4. Fast-forward the reviewed branch to `main` without force pushing.
5. Deploy the exact resulting SHA to the existing Vercel production project.
6. Keep all Phase 2 child flags off, run anonymous/auth-boundary and runtime smoke, then observe.

Stop immediately on remote drift, an extra pending migration, failed backup visibility, failed
post-apply assertion, Git non-fast-forward, SHA mismatch, production error regression, or any
unexpected cost/background-backfill write.

## First action on resume

Read this file and record the Owner's explicit Option A, B, or C decision. If A or B is approved,
re-run fetch, migration list, exact dry-run, backup listing and security advisors from fresh state;
do not reuse this snapshot as write authorization.
