---
schema_version: 1
task_id: "TASK-20260710-009-security-reliability-hardening-release"
title: "RepairDesk 高优先级安全与可靠性加固发布"
status: "conditional"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["API", "ARCH", "DATA", "DOC", "FLOW", "INT", "OPS", "QA", "SEC"]
created_at: "2026-07-10T13:59:03Z"
updated_at: "2026-07-10T19:09:46Z"
closed_at: "2026-07-10T19:03:17Z"
---
# Task — RepairDesk 高优先级安全与可靠性加固发布

## Owner request

> 规划计划并开始设定目标并开始执行计划，完成后推送 main 以及应用数据库。

The active Codex goal is the P1 security/reliability hardening release derived from
`docs/PROJECT_HEALTH_ARCHITECTURE_AUDIT_2026-07-10.md`.

## Business value

修复已确认的权限、认证、输入、分页、运维脚本和关键数据一致性风险，在可恢复门禁下推送 main 并应用 linked Supabase 数据库变更。

## Scope in

- Customer read route authorization and role behavior tests.
- Trusted Supabase email-confirmation source; no user-editable metadata trust.
- Runtime Zod enums for order type, order status, and approval status.
- Correctness beyond the Supabase 1000-row cap for orders, inventory, and legacy customer fallbacks.
- Safe target/store/backup/confirmation gates for seed, reset, and SeaTable import scripts.
- Strict business E2E that fails on login/empty business data and does not overwrite tracked screenshots.
- Additive Postgres migrations for atomic/idempotent payment recording and any independently approved bounded command.
- Device-unlock credential mitigation only where the design does not invent a key-management or retention policy.
- Documentation, task memory, independent review, scoped commits, direct `main` push, linked database apply, post-apply verification and observation.

## Scope out

- Microservices, framework replacement, route-group/UI-shell refactor, broad observability work, or repository-wide cleanup.
- Bulk deletion of duplicate files, screenshots, exports, customer data, historical unlock values, or migration-history records.
- `supabase migration repair`, destructive SQL, schema contraction, secret rotation, KMS/paid-service procurement, or manual production-data edits without a new explicit decision.
- Unrelated product features and cosmetic refactors.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- Main thread is the only writer and release operator; department agents remain read-only.
- Existing dirty screenshots and duplicate-like untracked files are user assets and remain untouched/uncommitted.
- Existing page layout and UI must not change. TASK-010 customer-search UI files are explicitly outside this release manifest.
- All migrations are additive/compatible and must be created with `supabase migration new`.
- No linked database write until target, migration history, exact pending set, recovery evidence and dry-run pass.
- A missing safe key-management or retention decision is a formal stop for unlock-vault migration, not permission to invent one.

## Acceptance criteria

- [x] 已确认的客户读取权限漏接、邮箱验证元数据、运行时枚举、分页上限、危险脚本和 E2E 可信门均有代码修复与回归证据；严格桌面 E2E 11/11 通过。
- [x] payment-only 数据库变更具有迁移、兼容、校验、前滚和 linked dry-run 证据；目标项目、精确 pending set 和迁移历史明确。广泛数据库门仍为 NO-GO。
- [x] 关键付款写入已通过原子/幂等 ledger RPC 实施；设备解锁凭据因缺少批准的密钥管理/保留政策形成明确阻断，没有伪装完成或自动清理。
- [x] agents、lint、typecheck、710 tests、build、核心 E2E、pgTAP 19/19 及独立安全/数据/QA 审查均有最终证据。
- [x] 范围化提交 `cee5a1b4` 已推送 `main`；payment migration 已应用并复验；Vercel 自动生产部署 Ready，近 20 分钟错误扫描无结果。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Owner authorized direct `main` push and database application | approved instruction | current owner request | valid for this task subject to safety gates |
| Local `main` equals fetched `origin/main` at `705c7511` | verified | `git fetch --prune`; `git rev-parse` | baseline recorded |
| Worktree was dirty before implementation | verified | `git status --short --branch` | preserve three modified screenshots and duplicate-like untracked assets |
| Customer read routes omit the existing `customer:list/detail` gate | verified | router + permissions matrix | Wave 1 blocker |
| Supabase `user_metadata` is user editable and unsafe for authorization | verified external | current official Supabase Users docs | remove both fallbacks |
| Order type/status/approval schemas use compile-time casts, not runtime enums | verified | schemas + direct safeParse reproduction | fix all three |
| Order normal pagination and inventory/legacy customer reads can truncate at 1000 | verified | repositories + Supabase range behavior | Wave 1 correctness fix |
| Payment update and event insert are not atomic | verified | order repository | additive RPC/ledger candidate |
| Supabase CLI is 2.101.0 | verified | `supabase --version` | use discovered CLI flags only |
| Linked project is the intended production target | assumption | repository link configuration | must verify without printing credentials before apply |
| Current remote draft objects/history, table counts and backup recovery state | unknown | linked read-only preflight required | database gate |
| Approved unlock credential retention window and external key-management mechanism | unknown/high-impact | no current approved decision | do not invent or purge |
| TASK-009 scoped commit reached `origin/main` | verified | `git fetch --prune`; refs/reflog; commit `cee5a1b4` | complete |
| Git push automatically deployed to Vercel production | verified | deployment `dpl_CehRUKZ7WhybvvJhbaFFQZjwnwKA`; production aliases; error-log scan | Ready; observe normally |
| Linked payment apply and main push were performed by a concurrent shared-worktree execution path | observed with corroboration | task checkpoint E-025 plus DB/Git timestamps | coordination provenance is incomplete; no evidence that `migration list` itself mutates schema |

## Decision and approval points

- **AP-01 approved:** minimal compatible code/test/docs implementation and scoped direct push to `main`.
- **AP-02 conditionally approved:** apply additive linked Supabase migrations only after exact-target, aligned-history, expected-pending, dry-run, backup/recovery and rollback/forward-fix evidence pass.
- **AP-03 not approved:** destructive data cleanup, migration-history repair, secret handling/rotation, new paid KMS, or historical unlock-value purge.
- **AP-04 release side effect:** the Owner-requested `main` push includes any already-configured automatic Vercel deployment; no manual external deployment is inferred beyond that.
- **AP-05 reserved product/privacy choice:** unlock credential retention/key-management is implemented only if an existing approved policy supplies the answer; otherwise it exits as a documented blocking follow-up.

## Work packages

- WP-00 context, official research, baseline and task contract.
- WP-01 customer read authorization and five-role regression tests.
- WP-02 trusted email confirmation and runtime enum validation.
- WP-03 row-cap-safe orders/inventory/customer reads.
- WP-04 destructive admin script target/backup/confirmation gates.
- WP-05 strict business E2E and isolated artifacts.
- WP-06 atomic/idempotent payment ledger + RPC migration and repository adapter.
- WP-07 independently reviewed bounded invite/order command improvements where safe.
- WP-08 device unlock decision gate and non-destructive mitigation.
- WP-09 independent ARCH/DATA/SEC/QA review, full verification and documentation sync.
- WP-10 scoped commit/push, linked migration apply, post-apply verification, observation and closeout.

## Risk and autonomy classification

- Complexity: T3; permissions/auth/API/repositories/scripts/tests/database/release.
- Risk: R4, taking the maximum of customer PII, payment consistency and production database impact.
- Autonomy: L2 controlled implementation. The Owner's current instruction supplies the D4 push/apply approval, but only inside AP-01/AP-02 conditions.
- Mandatory independent reviewers: ARCH/API, DATA/SEC and QA/OPS.
- Reclassify/pause triggers: unexpected remote migration, destructive pending SQL, target mismatch, inability to prove recovery, secret exposure, existing code overlap, or a migration requiring a product/retention decision.

## Release order

1. Implement and verify compatible code plus additive migrations locally.
2. Independent review and final diff audit.
3. Freeze the exact manifest in a clean worktree; exclude TASK-010 and all unrelated assets.
4. Reconfirm linked target/history, recovery evidence, security posture and exact pending set.
5. Only after the Database Application Gate or a written payment-only exception passes, apply the reviewed additive DB expand migration first.
6. Verify table/function/grants/RLS and PostgREST RPC visibility, then push the scoped application commit to `main`.
7. Run post-push payment smoke/E2E and observation.

Application code must not deploy before the required RPC exists. The API accepts stale-browser payment bodies without a client idempotency key and generates a server key, while new clients provide a stable retry key.

## Visual evidence

- Authorization/auth/schema/script/database work has no new dedicated UI by default.
- Inventory/order list behavior and strict E2E affect browser-visible pages; capture a sanitized mock-data screenshot if those pages materially change or are used for final smoke evidence.
- Never use production customer PII in screenshots.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
