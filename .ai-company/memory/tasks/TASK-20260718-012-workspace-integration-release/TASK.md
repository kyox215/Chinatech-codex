---
schema_version: 1
task_id: "TASK-20260718-012-workspace-integration-release"
title: "整合并发布此前所有已完成改动，然后启动库存 V2 Phase 0"
status: "in_progress"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "IntegrationLead"
departments: ["integration", "architecture", "data", "security", "qa", "release", "documentation"]
created_at: "2026-07-18T18:03:43Z"
updated_at: "2026-07-18T19:32:51Z"
---
# Task — 整合并发布此前所有已完成改动，然后启动库存 V2 Phase 0

## Owner request

“先推送并应用之前的所有改动，然后在开始下一步。”

## Normalized objective

完整盘点当前 RepairDesk 主工作区、隔离工作树、任务记忆、本地提交及 Supabase migration 候选；仅将已经完成、验收且获得本次发布授权的改动整合到最新 `origin/main`，通过逐阶段验证后非强制推送、精确应用获准迁移、部署同一提交并验证生产。发布稳定后，才开始库存商品 V2 Phase 0。

## Scope in

- 当前主工作区全部 tracked/untracked 改动的任务归属与完成状态。
- 当前本地领先提交、现有隔离工作树和未进入 `origin/main` 的已完成发布切片。
- 六份门店生命周期 migration 候选的任务、依赖、RLS/grant、恢复和启用边界审查。
- 基于最新 `origin/main` 的隔离集成、逐切片测试、快进推送和同 SHA 部署。
- 发布后生产冒烟、错误日志、截图或等价证据、回滚可用性检查。
- 发布关闭后启动 `TASK-20260718-011-inventory-product-v2-plan` 的 Phase 0。

## Scope out

- 未完成、仅规划、已拒绝、缺验收证据或与最新远端冲突的工作。
- 真实门店关闭、删除、purge、恢复演练中的生产数据写入或 feature flag 开启。
- 未经精确审查的 `--include-all` migration 推送、强推、改写历史、删除用户工作树或 stash。
- 付费 AI、真实客户 PII 传输、库存 V1 删除、库存 V2 生产迁移或生产发布。
- 任何秘密读取、输出或提交。

## Risk and authority

- **T3 / R4 / L1**：跨任务、跨模块、数据库和生产发布；主线程只在逐项证据门禁内执行。
- Owner 本条消息明确批准 Git push、已批准迁移 apply 与应用部署。
- 该批准不等于批准真实 store purge、破坏性数据操作、未验收功能启用或库存 V2 生产变化。
- D3/R4 动作必须在精确目标、备份/恢复证据、dry-run、回滚和 post-check 就绪后执行。

## Acceptance criteria

- [ ] 每个当前变更、候选提交和 migration 都被归入任务/状态/发布决策矩阵，不使用宽泛 `git add -A` 代替归属审查。
- [ ] 原主工作区与所有用户改动保持可恢复，不 reset、clean 或覆盖；集成在最新 `origin/main` 隔离工作树完成。
- [ ] 每个进入发布的任务切片都有独立验证证据；跨切片整体验证通过 lint、typecheck、test、build 及相关浏览器流程。
- [ ] 权限、租户隔离、敏感操作、RLS、grant、SECURITY DEFINER 和 feature flag 经过独立复核。
- [ ] migration history 与 linked database 对齐；只 dry-run/apply 明确批准的精确迁移，不使用 `--include-all`。
- [ ] `origin/main` 非强制快进到记录的提交 SHA；生产部署为同一 SHA 且 READY。
- [ ] 生产关键流程冒烟、错误日志、截图/替代证据和回滚入口验证完成。
- [ ] 发布任务完成正式 closeout 和 memory checkpoint；随后启动库存 V2 Phase 0，且仍不删除 V1、不 apply V2 migration、不启用付费 AI。

## Phase gates

1. [PHASE_01_INVENTORY.md](./PHASE_01_INVENTORY.md) — 改动与任务归属矩阵。
2. [PHASE_02_INTEGRATION.md](./PHASE_02_INTEGRATION.md) — 最新主线隔离集成。
3. [PHASE_03_VALIDATION.md](./PHASE_03_VALIDATION.md) — 逐切片与整体验证。
4. [PHASE_04_DATABASE.md](./PHASE_04_DATABASE.md) — linked dry-run 与精确 apply。
5. [PHASE_05_RELEASE.md](./PHASE_05_RELEASE.md) — push、deploy、runtime 验证。
6. [PHASE_06_CLOSEOUT.md](./PHASE_06_CLOSEOUT.md) — 文档、记忆与遗漏审计。
7. [PHASE_07_INVENTORY_V2_PHASE0.md](./PHASE_07_INVENTORY_V2_PHASE0.md) — 库存 V2 Phase 0 启动。

## Agent plan

- Architecture / Explorer：只读，归类 Git diff、任务、工作树和远端重叠。
- Data + Security：只读，迁移、RLS、grant、敏感状态和生产 apply 门禁。
- QA + Release：只读，验收证据、测试矩阵、截图、部署和回滚顺序。
- Integration Lead：唯一写入者；拥有任务记忆、隔离集成、staging、commit、push、migration、deploy 和最终结论。

## Rollback

- Git：单一或有序 release commits 可 `git revert`；禁止强推。
- Vercel：保留前一 production deployment，冒烟失败立即 rollback/promote 已验证版本。
- Supabase：每份迁移必须在 apply 前记录备份/恢复和兼容性策略；破坏性、不可逆或无恢复证据的迁移不执行。
- Workspace：不修改原工作树的恢复句柄；集成工作树可独立丢弃而不影响用户改动。

## Stop conditions

- 无法把某项改动证明为已完成/已批准任务。
- 最新远端已包含不同实现，且安全合并需要产品方向决策。
- migration dry-run/history、备份恢复、RLS/grant 或权限复核未通过。
- 任一关键测试、构建、生产冒烟或日志门禁失败。
- 发现秘密、PII 泄露、真实 purge/删除路径可能被启用。
