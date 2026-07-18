---
schema_version: 1
task_id: "TASK-20260718-013-inventory-v2-production-canary"
title: "库存商品 V2 生产恢复门禁与 Chinatech 单店灰度"
status: "active"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
departments: ["data", "documentation", "integration", "qa", "release", "security"]
created_at: "2026-07-18T19:43:02Z"
updated_at: "2026-07-18T20:27:57Z"
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
- 精确应用 `20260718175622`、`20260718181148` 两份 additive migration。
- 新建并审查独立 migration，仅向 `service_role` grant 两个 V2 RPC 的 EXECUTE。
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
- [ ] 两份 V2 additive migrations 精确应用且后置元数据/RLS/grants/幂等检查通过
- [ ] 仅 Chinatech 门店进入 allowlist，V1 写入保持开启
- [ ] shadow、commands、UI 分阶段启用并完成生产冒烟、对账和回滚验证
- [ ] 任何异常先关闭 UI/commands 并保留 V2 数据证据

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Web/base release is current | verified | `origin/main=19c4feb8`; Vercel `dpl_FE2Xa6p9nZ8NGNms9zmVfCzoUhvV` production READY with exact same SHA | dormant release passed |
| Production target | verified | `supabase/config.toml`; MCP project | `xluzcoduqsdvjoouqhkc`, ACTIVE_HEALTHY, PG 17.6 |
| V2 migrations pending | verified with new blocker | final linked dry-run | four migrations are pending: unapproved AI cost governance `20260718174042` precedes the three approved V2 migrations |
| Backup visibility | verified | `supabase backups list` | physical backup completed 2026-07-18 06:49Z; PITR disabled |
| Data-level restore drill | verified | restricted logical dump, isolated PostgreSQL 17 restore, row-count fingerprint | 116 dumped tables / 40,457 rows exactly restored; two expected empty managed migration tables excluded from data dump |
| Migration compatibility | verified | full data restore plus all three migrations | first rehearsal caught UUID FK and UUID validation defects; corrected one-shot definitions execute on restored production data |
| Runtime transaction behavior | verified in rollback-only restore | `RECOVERY_CANARY_ROLLBACK.sql` | intake, duplicate guard, replay, sale, conflict guard PASS; zero residual rows |
| Exact production apply | blocked | task-011 contract plus linked dry-run | cannot apply only the three V2 versions without bypassing migration order; `--include-all` and AI migration apply are unapproved |
| Historical full reset drift | verified risk | runbook and prior isolated validation | do not edit applied history; use production metadata + isolated restore |

## Decision and approval points

- **R4 / L1 / D4.** Owner has approved the production recovery-and-canary objective, exact additive V2 migrations, minimal RPC enablement and one-store feature rollout.
- The no-cost logical data recovery drill satisfies this runbook gate. A paid restore-to-new-project remains an optional last-resort exercise and still requires separate approval.
- Destructive restore over the live project, V1 disablement, all-store expansion and data deletion remain unapproved.
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
