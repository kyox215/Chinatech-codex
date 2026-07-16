# Checkpoints — TASK-20260716-005-device-custody-status-implementation

## 2026-07-16T18:23:37Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.
## 2026-07-16T18:25:43Z — 已恢复并批准留机/未留机规划，建立 T3/R3/L2 实施合同；main 与 origin/main 均为 6717932e，当前未提交内容仅为同任务规划记忆。生产 migration/deploy 仍为 D3 单独门禁，主线程单一写入。

- **Phase:** implementation_wp01
- **Completed/current state:** 已恢复并批准留机/未留机规划，建立 T3/R3/L2 实施合同；main 与 origin/main 均为 6717932e，当前未提交内容仅为同任务规划记忆。生产 migration/deploy 仍为 D3 单独门禁，主线程单一写入。
- **Next:** 实施 WP-01：先完成数据模型、migration、类型/API/repository、取消/完成/状态门禁与定向测试，再进入 UI。
- **Decision:** 使用 nullable with_shop/with_customer，旧行 NULL；不复用 order_type/accessory_notes；不静默丢字段；生产 DB/deploy 未授权。
- **Evidence:**
  - TASK-20260716-004 PLAN/EVIDENCE; git fetch --prune; HEAD==origin/main 6717932e; TASK-20260716-005 TASK.md
- **Recorded by:** CEO-Orchestrator
## 2026-07-16T21:18:03Z — WP-01 至 WP-05 本地实现已完成，定向与全量测试、lint、typecheck、build、agents:check 已取得通过证据；发布前复核发现 origin/main 在执行期间前进 2 个提交且与订单模块重叠。

- **Phase:** integration_rebase
- **Completed/current state:** WP-01 至 WP-05 本地实现已完成，定向与全量测试、lint、typecheck、build、agents:check 已取得通过证据；发布前复核发现 origin/main 在执行期间前进 2 个提交且与订单模块重叠。
- **Next:** 先保存任务提交，在最新 origin/main 上安全 rebase 并人工解冲突；随后重新执行 diff、全量门禁、E2E/截图和发布链路检查。
- **Decision:** 禁止 force push 或覆盖上游；旧基线验证不作为最终发布证据；生产 migration/deploy 继续保持 D3 门禁。
- **Blocker:** 必须先集成远端并重新验证；linked Supabase migration history/type parity 尚未核实。
- **Evidence:**
  - git status --branch: main behind 2; origin/main=184672fe; upstream overlaps order detail/list/task/repository/mock/types/print/workbook.
- **Recorded by:** CEO-Orchestrator

## 2026-07-16T21:58:17Z — 最新基线集成、独立复核与本地发布门禁完成

- **Phase:** release_gate
- **Completed/current state:** 实施分支已 rebase 到 `origin/main@184672fe` 并人工保留上游取消财务修复；复核发现并修复自定义状态 enum cast、exception-only 取消、实物流程直接交还、通知并发写入、kiosk 自身写入版本冲突、移动卡片遮挡与 JSON explicit-null 绕过。全量门禁及 3 条 Playwright E2E 已通过，最终 mock 截图已生成并转换为真实 PNG。
- **Decision:** 离线创建继续 `flag=0` 且 DB RPC fail closed；生产库未有新列时应用创建/更新路径 fail closed；不把通知三段写入或 kiosk 跨表接受夸大为完全事务化。
- **Release blocker:** 生产 Supabase 尚无 `device_custody_status`；Vercel 的 main push 会自动生产部署。必须由 Owner 明确批准 linked dry-run、migration apply、post-check，再 push main。
- **Evidence:** `agents:check`, `lint`, `typecheck`, 151 test files / 1033 tests, production build, Playwright 3/3, evidence screenshots, Supabase/Vercel read-only inspection.
- **Recorded by:** CEO-Orchestrator
## 2026-07-16T21:59:51Z — 设备保管端到端实现已完成最新基线 rebase、独立复核、全量门禁、Playwright 3/3 与 mock 截图；复核结论有条件 GO。生产 Supabase 尚无新列且 main 会自动部署，因此当前停在 D3 发布门禁。

- **Phase:** release_gate
- **Completed/current state:** 设备保管端到端实现已完成最新基线 rebase、独立复核、全量门禁、Playwright 3/3 与 mock 截图；复核结论有条件 GO。生产 Supabase 尚无新列且 main 会自动部署，因此当前停在 D3 发布门禁。
- **Next:** 精确提交任务文件并再次 fetch；获得 Owner 明确批准后执行 linked dry-run、先应用 migration 与 post-check，再 fast-forward/push main 并验证生产。
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator
## 2026-07-16T23:15:44Z — 只读 SQL 复核完成：新 20260717001000 前向迁移位于四个已应用 finance migrations 之后，custody 列/约束、custom done/cancel bucket、取消退机幂等、终态 custody 修正、void/reopen 触发器门禁与 service_role ACL 已逐段核对。当前确定性 stop-ship 是 device-custody-migration.test.ts 仍断言已从新 SQL 移除的 completed_reopen_required、current_status 等旧实现文本；未执行数据库迁移、提交或推送，也未取得 PostgreSQL parser/replay 证据。工作树仍为业务写入者既有 5 个 M、旧迁移 D、新迁移 untracked。

- **Phase:** implementation
- **Completed/current state:** 只读 SQL 复核完成：新 20260717001000 前向迁移位于四个已应用 finance migrations 之后，custody 列/约束、custom done/cancel bucket、取消退机幂等、终态 custody 修正、void/reopen 触发器门禁与 service_role ACL 已逐段核对。当前确定性 stop-ship 是 device-custody-migration.test.ts 仍断言已从新 SQL 移除的 completed_reopen_required、current_status 等旧实现文本；未执行数据库迁移、提交或推送，也未取得 PostgreSQL parser/replay 证据。工作树仍为业务写入者既有 5 个 M、旧迁移 D、新迁移 untracked。
- **Next:** 业务写入者先更新迁移静态测试以断言新 terminal custody RPC/custom bucket/trigger 契约，再在隔离 PG17 当前 schema 上用 ON_ERROR_STOP 回放四个 finance migrations 加 20260717001000，检查函数签名/ACL/约束/触发器及 void-reopen-cancel-return 状态机；通过前不得 dry-run/apply/push。
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator
## 2026-07-16T23:24:09Z — 冻结快照复核至 SQL SHA 2a28ef6f338e：复核中发现并由业务写入者修正 terminal custody helper 的 NULL actor 授权绕过、NULL custody 写入、order-data update NULL 回退，以及 custom/literal/exception cancelled 对 legacy NULL custody 的 DB 守卫。当前 SQL 静态结构与 finance terminal RPC/trigger/ACL 兼容方向未见新的 stop-ship；但定向 migration test 实测 1 failed/9 passed，device-custody-migration.test.ts:139 仍查找已从 atomic RPC 删除的 custody_return_confirmed action，indexOf 为 -1。未执行数据库 migration、Supabase 写入、提交、推送或部署；尚无 PG17 parser/current-schema replay 证据。

- **Phase:** implementation
- **Completed/current state:** 冻结快照复核至 SQL SHA 2a28ef6f338e：复核中发现并由业务写入者修正 terminal custody helper 的 NULL actor 授权绕过、NULL custody 写入、order-data update NULL 回退，以及 custom/literal/exception cancelled 对 legacy NULL custody 的 DB 守卫。当前 SQL 静态结构与 finance terminal RPC/trigger/ACL 兼容方向未见新的 stop-ship；但定向 migration test 实测 1 failed/9 passed，device-custody-migration.test.ts:139 仍查找已从 atomic RPC 删除的 custody_return_confirmed action，indexOf 为 -1。未执行数据库 migration、Supabase 写入、提交、推送或部署；尚无 PG17 parser/current-schema replay 证据。
- **Next:** 业务写入者修正 migration test 的专用 return RPC 定位后重跑；随后在隔离 PG17 当前 schema 上 ON_ERROR_STOP 回放 20260716221119/221139/221159/221448 加 20260717001000，并以 pg_catalog 验证函数签名、service_role ACL、既有 trigger 绑定、约束和 void/reopen/custom-cancel/return 幂等状态机。上述通过前不得 apply/push。
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator
## 2026-07-16T23:24:41Z — 冻结 SQL SHA 2a28ef6f338e 的只读复核完成。复核中发现的 terminal custody helper NULL actor 授权、NULL custody、order-data update NULL 以及 literal/custom/exception cancelled legacy NULL 守卫已由业务写入者修正；专用 return RPC、custom bucket、void/reopen trigger、service_role ACL 和 finance migration 顺序的静态兼容未见未解决 stop-ship。device-custody-migration.test.ts 已修正专用 return 定位并定向实测 10/10 通过。未执行数据库 migration、Supabase 写入、提交、推送或部署；PG17 current-schema SQL replay/catalog state-machine 仍是发布硬门禁。

- **Phase:** implementation
- **Completed/current state:** 冻结 SQL SHA 2a28ef6f338e 的只读复核完成。复核中发现的 terminal custody helper NULL actor 授权、NULL custody、order-data update NULL 以及 literal/custom/exception cancelled legacy NULL 守卫已由业务写入者修正；专用 return RPC、custom bucket、void/reopen trigger、service_role ACL 和 finance migration 顺序的静态兼容未见未解决 stop-ship。device-custody-migration.test.ts 已修正专用 return 定位并定向实测 10/10 通过。未执行数据库 migration、Supabase 写入、提交、推送或部署；PG17 current-schema SQL replay/catalog state-machine 仍是发布硬门禁。
- **Next:** 在隔离 PG17 当前 schema 上以 ON_ERROR_STOP 回放 20260716221119/221139/221159/221448 加 20260717001000，随后用 pg_catalog 验证精确函数签名、service_role ACL、既有 trigger 绑定、约束，以及 void/reopen/custom-cancel/return 幂等状态机；还要 preflight 确认旧 20260716183000 从未应用。全部通过前不得生产 apply/push。
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator
## 2026-07-16T23:25:22Z — 最终复核前重新验证 diff：SQL 仍为 SHA 2a28ef6f338e，migration static test 文件为 SHA e6bdd981df3a；定向测试 10/10 通过。自上一检查点后无 SQL 或该测试快照漂移。静态审查无未解决 stop-ship，但未取得 PG17 current-schema replay/catalog 状态机证据，因此仍为有条件通过、禁止生产 apply/push。

- **Phase:** implementation
- **Completed/current state:** 最终复核前重新验证 diff：SQL 仍为 SHA 2a28ef6f338e，migration static test 文件为 SHA e6bdd981df3a；定向测试 10/10 通过。自上一检查点后无 SQL 或该测试快照漂移。静态审查无未解决 stop-ship，但未取得 PG17 current-schema replay/catalog 状态机证据，因此仍为有条件通过、禁止生产 apply/push。
- **Next:** 由主线程执行隔离 PG17 ON_ERROR_STOP replay、pg_catalog 函数/ACL/trigger/constraint 检查及 void-reopen-custom-cancel-return 状态机测试；并确认旧 20260716183000 未在目标环境应用。
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator
