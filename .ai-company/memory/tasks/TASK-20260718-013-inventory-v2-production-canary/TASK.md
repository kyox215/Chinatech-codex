---
schema_version: 1
task_id: "TASK-20260718-013-inventory-v2-production-canary"
title: "库存商品 V2 生产恢复门禁与 Chinatech 单店灰度"
status: "closed"
phase: "closeout"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
departments: ["data", "documentation", "integration", "qa", "release", "security"]
created_at: "2026-07-18T19:43:02Z"
updated_at: "2026-07-18T22:00:11Z"
closed_at: "2026-07-18T21:51:17Z"
---
# Task — 库存商品 V2 生产恢复门禁与 Chinatech 单店灰度

## Owner request

Owner 选中“按发布运行手册完成数据库恢复验证和单店灰度”，并明确指令“开始执行”。

## Business value

在保留 V1 和回滚能力的前提下，让 Chinatech 单店安全启用库存 V2 六步录入与原子售卖。

## Scope in

- 目标生产 Supabase：`ChinaTech_date` / `xluzcoduqsdvjoouqhkc`。
- 核对物理备份、迁移历史、恢复路径、数据库健康和精确发布范围。
- 对生产 schema 做无 PII 的逻辑 schema 导出与隔离恢复验证。
- 在权限受限的临时目录完成逻辑数据备份与完整数据恢复演练；不把备份内容写入仓库、日志或截图。
- 仅当无费用的逻辑恢复门禁失败且 Owner 另行批准费用时，才使用官方 physical backup “Restore to a New Project”。
- 按 linked history 精确审查四份候选 migration：默认休眠的 AI 成本治理、V2 foundation、V2 identity、V2 service-role grants。
- grant migration 仅向 `service_role` 开放两个 V2 命令 RPC 和一个只读影子对账 RPC。
- 仅把 Chinatech 门店加入 allowlist；按 schema → shadow → commands → UI 顺序启用。
- 保持 `INVENTORY_LEGACY_MUTATIONS_ENABLED=1`，执行生产冒烟、对账、日志和回滚验证。

## Scope out

- 关闭 V1 写入、全店开放、删除 V1/V2 表或历史数据。
- 真实店铺 purge、store lifecycle worker/cron 激活、付费 AI 或客户通信。
- 把生产 PII、数据库凭据或备份内容写入仓库、记忆、日志或截图。
- 使用 `--include-all`、改写已应用历史 migration、强推或清理原脏工作区。

## Hard constraints

- 原工作区保持不变；仅在 `/private/tmp/repairdesk-inventory-v2-production-canary-20260718` 单一写入。
- 生产动作严格串行；任何恢复、迁移、RLS/grant、运行时或对账门禁失败立即停止。
- UI/commands 异常先关闭开关和移除 allowlist，不删除 V2 数据。
- RPC 不得授权 `public`、`anon`、`authenticated`；V2 表保持 RLS 和无浏览器直连 grant。
- 任何新增费用必须在显示金额后由 Owner 单独确认。
- 不复述或持久化 Supabase CLI 临时登录口令；后续避免会回显凭据的 dry-run 路径。

## Acceptance criteria

- [x] 生产恢复/备份证据满足发布门禁，或明确记录阻断并停止
- [x] 四份候选 additive migrations 精确应用且后置元数据/RLS/grants/幂等检查通过
- [x] 仅 Chinatech 门店进入 allowlist，V1 写入保持开启
- [x] shadow、commands、UI 分阶段启用并完成生产冒烟、对账和回滚验证
- [x] 回滚路径已以 commands/UI 关闭态和生产事务强制回滚两种方式验证，未触发数据删除

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Web/base release is current | verified | `origin/main=d6b9eaca`; Vercel production exact-SHA deployment READY | Chinatech canary deployment rebuilt from the same release SHA |
| Production target | verified | `supabase/config.toml`; MCP project | `xluzcoduqsdvjoouqhkc`, ACTIVE_HEALTHY, PG 17.6 |
| V2 migration history | verified in production | linked migration list and final dry-run | `20260718174042`, `20260718175622`, `20260718181148`, `20260718195257` all applied; remote up to date |
| Backup visibility | verified | `supabase backups list` | physical backup completed 2026-07-18 06:49Z; PITR disabled |
| Data-level restore drill | verified | restricted logical dump, isolated PostgreSQL 17 restore, row-count fingerprint | 116 dumped tables / 40,458 rows exactly restored; two expected empty managed migration tables excluded from data dump |
| Migration compatibility | verified | fresh full-data restore plus all four pending migrations in exact linked order | AI remains dormant; corrected one-shot V2 definitions execute on restored production data |
| Runtime transaction behavior | verified in rollback-only restore | `RECOVERY_CANARY_ROLLBACK.sql` | intake, duplicate guard, replay, atomic sale, V2 status/movement projection, reconciliation and conflict guard PASS; zero residual rows |
| Shadow reconciliation | verified | `repairdesk_inventory_v2_reconcile` and server repository/route | owner/manager + schema/shadow/allowlist gated; empty Chinatech baseline healthy; browser roles have no execute grant |
| Sale projection defect | fixed and verified | foundation migration plus enhanced recovery script | V2 unit now becomes `sold`, version increments and one `sell -1` movement is written atomically |
| Exact production apply | completed | Owner approval, `supabase db push --linked --yes`, post-apply catalog checks | four approved additive migrations applied in linked order; no `--include-all`, seed, V1 disablement or destructive SQL |
| Historical full reset drift | verified risk | runbook and prior isolated validation | do not edit applied history; use production metadata + isolated restore |
| Chinatech canary | verified in production | Vercel flags, staged deployments and authenticated browser | schema/shadow first, then commands/UI; allowlist contains only Chinatech and legacy mutations remain enabled |
| Production rollback | verified | `RECOVERY_CANARY_ROLLBACK.sql` and post-rollback reconciliation | intake/sale/idempotency/duplicate/conflict path passed inside transaction; all residual V2/AI rows zero and V1 inventory count remained 5 |
| Production observation | verified for release window | Vercel runtime errors/logs, Supabase PostgreSQL logs | no runtime error/warning/fatal on final deployment; recent PostgreSQL entries were normal LOG/checkpoint activity |

## Decision and approval points

- **R4 / L1 / D4.** Owner has approved the production recovery-and-canary objective, exact additive V2 migrations, minimal RPC enablement and one-store feature rollout.
- The no-cost logical data recovery drill satisfies this runbook gate. A paid restore-to-new-project remains an optional last-resort exercise and still requires separate approval.
- Destructive restore over the live project, V1 disablement, all-store expansion and data deletion remain unapproved.
- Chinatech is the only enabled store. Any second-store rollout, AI image-provider activation, V1 disablement or cleanup remains a new Owner approval point.
- Mandatory reviewers are DATA, SECURITY, QA and RELEASE; because the chain is sequential and touches production credentials/state, the Integration Lead performs the reviews in the main thread. `no-spawn reason`: parallel agents cannot safely own or observe the same production migration/flag state and must not handle secrets.

## Work packages

1. Baseline and recovery: backup list, health, migration history, schema-only and full logical-data isolated restore.
2. Migration contract: inspect V2 SQL, create minimal service-role grant migration, static/isolated tests and exact dry-run.
3. Production schema: apply only approved migrations, verify objects/RLS/grants/functions/history/advisors.
4. Canary configuration: resolve Chinatech store ID, schema/shadow/commands/UI flags and allowlist in stages.
5. Observation: synthetic/test inventory path, idempotency, duplicate, permission, data reconciliation, logs and rollback proof.
6. Closeout: docs, evidence, checkpoint, screenshot/no-screenshot evidence and residual risks.

## Verification matrix

- Migration history: MCP before/after exact versions.
- Schema/security: catalog queries for tables, composite FKs, indexes, RLS, ACL and function configuration.
- Recovery: physical backup visibility plus schema-only and full logical-data local restore; paid hosted clone is not required after the logical drill passed.
- Application: focused inventory tests, lint, typecheck, full tests and build for any code/config migration commit.
- Runtime: production auth boundary, V2 store context/route, synthetic canary operations, error logs and V1 fallback.
- Rollback: flags off + allowlist removal + RPC revoke; no down migration or data deletion.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.

## Closeout

- **Result:** complete. Production database, Chinatech one-store flags, desktop/mobile UI, rollback-only canary and immediate observation all passed.
- **Live state:** Chinatech Inventory V2 schema/shadow/commands/UI enabled; V1 mutations enabled; AI image recognition preserved but dormant/unconfigured; no V2 canary data retained.
- **Residual boundary:** keep the allowlist at one store and monitor before any expansion. Existing Supabase advisor warnings predate this release and were not changed by this task.
