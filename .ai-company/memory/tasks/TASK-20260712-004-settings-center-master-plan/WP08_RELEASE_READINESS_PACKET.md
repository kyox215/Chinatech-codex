# WP-08 Settings Center Release Readiness Packet

Status: **NO-GO — WP08 documentation and local verification may proceed; production prerequisites are not approved**
Prepared: 2026-07-13 CEST
Owner: RepairDesk Integration Lead
Target environment: not selected or approved
Current branch: `codex/settings-center-v2-20260712`
Current local Settings HEAD: `04273546`

This packet is a release plan, not release authorization. No migration, environment change, production
read, push, deployment, external communication, or real feature enablement is approved by this file.

> WP09 correction, 2026-07-14: this packet is the historical pre-integration snapshot. A direct final
> source-vs-main intersection found 32 common paths (23 product/code plus nine memory), not 24. Owner
> authorized local integration only; all twelve commits are now rebased on `origin/main@d5384e88` in
> `codex/settings-center-v2-integrated-20260714`. See `WP09_LATEST_MAIN_INTEGRATION_REPORT.md` for current
> gates; the refreshed local code/browser/build/visual matrix passes. Main's fail-closed buyback patch
> contains the earlier tenant/legal P1. Push/PR, database, flags,
> deployment and production remain unapproved.

## 1. Verified release-unit facts

- Settings implementation is 11 local commits from `6851117c` through `04273546`, followed by this
  WP08 verification/documentation package.
- After the WP08 package, the branch is **12 ahead / 8 behind** `origin/main`.
- Merge base: `a76852f61b09f1b84ccf0def957312026d6eb3b3`.
- `origin/main` at the WP08 review: `54c29e29`; WP09 refreshed through `70d211b2` to final target `d5384e88`.
- The two sides changed 32 common paths: 23 product/code paths and nine project-memory paths, including order/buyback/inventory screens and repositories,
  `src/lib/repairdesk/{api,types}.ts`, Router/schemas, mocks, and `ACTIVE_CONTEXT.md`.
- Therefore the current branch is not one deployable release unit, and its local build is not proof for
  a releasable latest-main integration. A clean, serialized integration worktree, split release units,
  and a complete post-integration gate are mandatory.

Local Settings commit order:

1. `6851117c` tenant-safe capabilities and output identity.
2. `c62223b0` responsive Settings overview.
3. `19895c2d` conflict-safe section drafts.
4. `9e9916ba` customer-output recovery.
5. `e2ef6ce6` account and store workspace.
6. `2049f2b2` notifications and default rules.
7. `6ff4c2cb` members, access, and suppliers.
8. `f311b06a` customer Kiosk workflows.
9. `deba58f7` Kiosk data boundaries and staged migration.
10. `2ef412d0` safe local workflow drafts.
11. `04273546` hardened order data center.
12. WP08 local verification, operator/release package, memory sync, and clean visual evidence (this commit).

## 2. Release decision

| Scope | Current decision | Blocking owner/evidence |
| ---- | ---- | ---- |
| Local code, tests, docs, synthetic screenshots | CONDITIONAL LOCAL PASS | WP09 is rebased to `d5384e88`; static, 179/1179 Vitest, 22-page build, 44-case desktop, 13-case feature-off/dashboard and six-image visual gates pass; local evidence commit remains |
| Push or PR from current branch | NO-GO | Not authorized by the local integration scope |
| Deploy complete Settings branch | NO-GO | Release-unit split and production gates remain open |
| Member role/grant production writes | NO-GO | DATA/SEC/QA approval, migration/RPC/CAS/transaction proof |
| Kiosk production or review writes | NO-GO | dual flags, migration Gate 2A, atomic finalize, limiting/token/retention policy |
| Workflow Apply | NO-GO | revision/CAS, one transaction RPC, historical preflight, atomic audit/outbox |
| Order-data export/preview | NO-GO | timed PII cleanup, ingress body limit, rate/concurrency/capacity evidence |
| Order-data Apply | NO-GO | export gates plus atomic staging, create/warranty parity, safe transaction and recovery proof |

No open production P1 has an Owner risk acceptance. WP-08 cannot mark the overall task unconditionally
closed or claim production readiness.

## 3. Required integration sequence

1. Obtain an explicit serialized release owner and a specific target environment.
2. Create a new clean worktree from the freshly fetched `origin/main`; do not merge/rebase in the
   original dirty checkout.
3. Integrate the 12 Settings commits in order. Resolve the 32 shared paths by preserving both the
   newer order/buyback changes and the Settings tenant/draft contracts; never choose one side wholesale.
4. Run source and migration-order review before editing any database object.
5. Keep all Kiosk and order-data flags at `0`. Keep workflow Apply locked.
6. Run the full post-integration gate and regenerate only task-owned screenshots.
7. Perform independent architecture, security/data, UI/UX, and release review on the integrated diff.
8. Present the exact integrated commit, migration plan, environment configuration, observation owner,
   rollback owner, and approval record to the Owner.
9. Only after separate approval may the Integration Lead push/open a PR, apply a database change, or
   deploy. Each action needs pre/post target assertions.

### Required release-unit split

Do not deploy the 12-commit branch as one artifact. Freeze and review these units independently:

1. **A — WP00–WP03 code-only foundation:** capability/tenant contracts, Settings shell, conflict-safe
   drafts, account/store, notifications and rules. WP02 strict client and API changes travel together.
2. **B — WP04 members/suppliers:** excluded from production until member actor/CAS/audit transaction
   work is complete. Member writes currently have no independent production kill switch.
3. **C — WP05 Kiosk:** first create a containment-only code unit with both flags default-off; database
   expand and any flag enablement remain later, separate units.
4. **D — WP06 workflow:** draft/read-only behavior may be reviewed independently; Apply is excluded
   until an atomic RPC and a dedicated default-off workflow-write kill switch exist.
5. **E — WP07 order data:** export/preview and Apply are separate rollout units. Apply is always last.

No unit inherits approval from another unit. The current branch must not be used as the Kiosk
containment artifact because it also contains unapproved member, workflow, and order-data work.

### Required overlap review

The integration reviewer must explicitly inspect:

- buyback workspace/model/screen shared changes;
- inventory screen/repository/mock changes;
- order hero/overview/detail/list/repository/mock changes;
- `src/lib/mock/api.ts`;
- `src/lib/repairdesk/api.ts`, `api.test.ts`, and `types.ts`;
- RepairDesk Router, schemas, and schema tests;
- `.ai-company/memory/ACTIVE_CONTEXT.md`.

## 4. Database and configuration dependency order

The repository timestamp order of the three Settings-related migrations is:

1. `20260710150000_order_data_roundtrip.sql`
2. `20260712002317_global_staff_permission_grants.sql`
3. `20260713144316_kiosk_integrity_expand.sql`

Before any database command, record linked migration history and the exact dry-run output. If the linked
environment lacks earlier files, a generic Kiosk apply can sweep order-data and member migrations into
the same operation. Any dry-run containing an unreviewed migration is an immediate stop. Never use
`--include-all` to bypass history drift.

### Stage A — code paths that must stay closed

- `REPAIRDESK_KIOSK_PRODUCTION_ENABLED=0`
- `REPAIRDESK_KIOSK_REVIEW_WRITES_ENABLED=0`
- `ORDER_DATA_EXPORT_ENABLED=0`
- `ORDER_DATA_APPLY_ENABLED=0`
- keep Realtime switches off until private-channel authorization is separately verified.
- member writes and workflow Apply do not have independent production kill switches; exclude them from
  production release units until default-off interlocks exist.

### Stage B — member/access database gate

Candidate migration: `20260712002317_global_staff_permission_grants.sql`.

Before any member role/grant production write:

- review actor membership/role revalidation and expected-version/CAS semantics;
- prove role/grant/member/access/audit integrity under failure;
- dry-run against the complete migration history;
- verify functions, grants, RLS, indexes/constraints, and exact caller privileges after apply;
- run five-role and two-store positive/negative tests.

### Stage C — Kiosk database gate

Candidate migration: `20260713144316_kiosk_integrity_expand.sql`.

- complete isolated PostgreSQL full-history reset/apply/lint Gate 2A;
- inspect historical constraint anomalies before validation;
- design atomic accept/return/finalize with audit/outbox and Storage compensation;
- approve pairing failure limiting, token lifecycle, role semantics, PII/signature retention and GDPR copy;
- keep both flags off through migration and code deployment; enable only in a separate approved step.

### Stage D — workflow gate

- perform a store-scoped read-only historical custom/default/closed-status preflight;
- decide repair/rollback for anomalies before changing production rows;
- add workflow revision/CAS and one atomic store-scoped RPC with active-order compatibility checks;
- return one complete accepted version and write audit/outbox atomically.

### Stage E — order-data gate

Candidate migration history includes `20260710150000_order_data_roundtrip.sql`.

- install and prove scheduled PII cleanup, monitoring, alerting, retry, deletion evidence, and policy;
- enforce a true streaming request-body limit for missing/chunked `Content-Length`;
- add per-user/store rate, concurrency, volume, timeout, and abandoned-batch controls;
- stage batch header plus all rows atomically;
- share normal order-creation initial workflow, default warranty, and warranty audit semantics;
- remove the candidate RPC's hard-coded `new` / `intake` / six-month behavior before approval;
- load-test and approve the synchronous maximum or design a resumable background workflow;
- runtime-validate Apply results and provide complete impact/recovery evidence;
- enable export/preview first; Apply is a separate later approval. Do not open rollback by default.

## 5. Post-integration quality gate

All commands run from the clean integrated worktree and must identify the exact commit:

```bash
npm run agents:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e:interactions:mock
```

Required additional evidence:

- nine direct Settings deep links and browser history;
- Owner/Manager/Technician/Sales/Viewer capability behavior using server projections;
- two-store transient data, draft, query-key, and late-response isolation;
- save/discard/cancel, 409 conflict, offline/error, and partial-success paths;
- Overlay Escape/focus/pointer/inert/hit-target recovery;
- 390, 430, 768, 1024, 1280, and 1440 widths with no page overflow;
- long store/email/supplier values, 50+ members, and 100-row import preview;
- migration-specific database tests when a migration is actually in the release unit.

Any code change after the final gate invalidates that gate. Any later remote main, database, environment,
or deployment change requires fresh pre/post assertions.

## 6. Progressive deployment proposal

This sequence is proposed, not approved:

1. Deploy to a non-production preview with every high-risk flag off.
2. Validate account/store/notifications/rules, read-only capability states, supplier views, locked
   workflow draft behavior, and blocked Kiosk/order-data behavior.
3. After database gates and a member-write kill switch, enable member writes for an internal synthetic
   store only.
4. Enable Kiosk only after its separate database/security approval and an observed synthetic pilot.
5. Enable order-data export/preview only after retention/ingress/resource gates; keep Apply off.
6. Enable order-data Apply only as the final independent rollout after transactional/load/recovery proof.

No stage automatically authorizes the next stage. Each has its own Owner decision and recorded evidence.

## 7. Observability and stop criteria

Before release, Platform/Operations must record the current baseline, dashboard/query, alert route,
on-call owner, and observation window for:

- Settings request count, latency, 4xx/5xx and stable 403/409/422 distributions;
- store-context mismatch and tenant-output readiness failures;
- audit write failures and Realtime publication failures;
- member/access conflict and partial-side-effect indicators;
- Kiosk pair/submit/review conflicts, orphan attachments, token failures, and review latency;
- workflow conflict/validation failures and active-order incompatibility;
- order-data upload rejection, preview/apply duration, partial/conflict counts, abandoned batches,
  staged-row count, and cleanup backlog/age.

Immediate zero-tolerance stop conditions:

- any confirmed cross-store data, transient secret, or output-identity leak;
- any authorization bypass or high-risk action without its required audit record;
- any workflow/Kiosk/member/order-data failure that leaves a partial business write outside the
  documented recovery boundary;
- migration/RLS/grant/catalog mismatch;
- inability to disable the affected high-risk module or identify the deployed commit.

Proposed service thresholds, pending baseline/Platform approval:

- pause on Settings 5xx over 2% for 5 minutes or more than twice the same-window baseline;
- pause a high-risk module when its conflict/partial rate exceeds twice the approved synthetic/pilot
  baseline for 10 minutes;
- stop Kiosk/order-data expansion on any unprocessed cleanup item older than its approved SLA;
- extend the observation window after any alert, retry storm, manual compensation, or rollback.

These are proposals. Without recorded production baselines and alert ownership, deployment remains NO-GO.

## 8. Rollback and forward-fix runbook

### Fast containment

1. Freeze expansion and external communication.
2. Set the affected Kiosk/order-data flags to `0`; verify blocked routes and zero new high-risk writes.
3. If the defect is in non-flagged Settings behavior, revert the scoped release commit(s) in a clean
   release branch. Never use `reset --hard` or clean the shared checkout.
4. Preserve logs, request IDs, audit metadata, batch/session IDs, deployed commit, flag history, and
   timestamps without copying customer PII into task memory.
5. Enter incident response for any tenant, security, data-integrity, or customer-impact issue.

### Database boundary

- Additive columns, indexes, checks, tables, and RPCs normally remain in place while code is rolled back.
- Do not drop or rewrite migration history as an emergency shortcut.
- Constraint validation and data repair use a separate reviewed forward migration/runbook.
- “Backup exists” is not restore proof. No data rollback is authorized without a verified restore point,
  rehearsal, affected-row scope, conflict policy, and Owner approval.

### Domain-specific recovery limits

- Member/access/audit writes are not claimed atomic until the approved transaction contract is live.
- Kiosk customer/order/attachment/session/event/audit side effects require compensation evidence.
- Workflow Apply is not enabled; never compensate by sequencing the four legacy routes.
- Order-data update rollback must respect later versions; created orders are not automatically deleted.

### Recovery verification

- confirm the intended commit and environment;
- confirm flags and blocked endpoints;
- rerun the affected synthetic user path and tenant-negative test;
- verify no new partial/cleanup backlog;
- record who authorized containment, rollback/forward-fix, and reopening.

## 9. Approval and release record

| Approval | Required owner | Status | Evidence/decision |
| ---- | ---- | ---- | ---- |
| Latest-main integration scope | Owner + Integration Lead | completed locally | Owner said "开始下一步"; WP09 integrated 32 exact overlaps without push/PR |
| Production target and release window | Owner + Operations | pending | No target selected |
| Member migration/write enablement | Owner + DATA + SEC + QA | pending | WP04 gate open |
| Kiosk migration/role/retention/enablement | Owner + DATA + SEC + Operations + QA | pending | WP05-B gates open |
| Workflow RPC/history repair policy | Owner + FLOW + DATA + SEC + QA | pending | WP06 gate open |
| Order-data retention/ingress/limit/Apply | Owner + DATA + SEC + Platform + QA | pending | WP07 gate open |
| Push / PR | Owner | pending | No push performed |
| Deployment | Owner + Release owner | pending | No deployment performed |
| External/customer communication | Owner | pending | None performed |

Release record fields to complete only after approval:

```text
integrated_commit:
target_environment:
migrations_and_checks:
flag_values_before_after:
release_owner:
approval_time_and_reference:
deployment_id:
smoke_test_actor_store:
observation_window:
dashboard_and_alert_owner:
rollback_or_forward_fix_result:
final_production_evidence:
```

Blank fields are intentional. A deployment cannot be reported as successful without real runtime and
data evidence tied to the exact target.
