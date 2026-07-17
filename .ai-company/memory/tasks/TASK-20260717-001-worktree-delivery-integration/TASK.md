---
schema_version: 1
task_id: "TASK-20260717-001-worktree-delivery-integration"
title: "工作区未提交改动保全、整合与发布准备"
status: "active"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["DATA", "DOC", "INT", "QA", "RELEASE", "SEC", "UX"]
created_at: "2026-07-17T01:27:26Z"
updated_at: "2026-07-17T02:04:23Z"
---

# Task — 工作区未提交改动保全、整合与发布准备

## Owner request

查看并列出大量未提交内容，判断是否需要推送；随后设定目标，按建议完成保全、整合、缺陷修复与下一步发布准备。

## Business value

保全原始脏工作区，按业务包整合到最新 main，关闭安全与一致性缺陷并形成可审计的发布候选。

## Scope in

- 冻结并验证原始脏工作区，提供 stash、保全 ref、恢复目录和内容指纹。
- 将 SeaTable 导入/状态、账号密码重置、Settings/Kiosk/迁移历史与设备保管并发成果整合到最新 `origin/main`。
- 修复 Kiosk 工单范围与竞态防护、终态打印/通知、Mock/真实状态机一致性、设备缓存失效、功能开关和客户嵌套弹窗溢出。
- 新增设备保管安全 hardening 向前迁移与 PG17 对抗测试；验证 Settings migration 的约束和索引。
- 完成静态质量门、完整测试、标准构建、Settings E2E、桌面端 E2E、截图证据与独立审查。
- 排除构建/E2E 生成漂移，整理可审计发布候选，并在最新远端状态上给出 DB-first 推送结论。
- 归档根 checkout 的两批分支切换残留，清除候选中所有 ` 2`/无扩展名冲突副本、重复截图和失效 worktree 元数据。

## Scope out

- 不自动应用 `20260714180000_kiosk_integrity_expand.sql` 或 `20260717030000_order_device_custody_security_hardening.sql` 到生产。
- 不自动推送 `main`、触发 Vercel 生产部署、删除原始保全快照或清除未证明可恢复的用户文件。
- 不在本任务内把 Kiosk 跨表流程重构为新 RPC；该架构变化需独立 DATA/SEC 设计和生产批准。

## Hard constraints

- 主线程是唯一写入者；审查 Agent 只读，不得 stage/commit/push/DB apply。
- 原始快照不得丢失；所有整合在隔离 worktree 和专用分支完成。Owner 已在后续目标中批准对已证明重复/被取代的根 checkout 残留执行可恢复归档，不授权丢弃保护 refs/stashes。
- 生产 DB、部署与 `main` 推送均为 D3 Owner 明确批准门禁，且必须 DB-first。
- 不记录 secrets、完整客户 PII、生产凭据或未验证的通过结论。
- 迁移只允许 forward-fix；不得改写已应用设备保管迁移或伪造历史数据。

## Acceptance criteria

- [x] 原始未提交内容有可验证的 stash、ref 与恢复目录
- [x] SeaTable、账号重置、Settings/Kiosk 与设备保管改动在最新 main 上完整整合
- [x] 应用、SQL、构建、桌面与 Settings E2E 门禁通过
- [x] 生成物与无关漂移排除，残余风险和 DB-first 推送门禁明确
- [x] 根 checkout 回到干净的最新 `main`；两批残留均有 stash/ref 可恢复
- [x] 最终候选的 997 个 tracked 冲突副本清零，包含 303 张 PNG 副本（`screenshots/` 下 290 张）

## Facts, assumptions, and unknowns

| Item                                                    | Type     | Evidence                                          | Status / next action              |
| ------------------------------------------------------- | -------- | ------------------------------------------------- | --------------------------------- |
| 原始 checkout 有 28 个 tracked 与 100 个 untracked 改动 | verified | 状态/差异/未跟踪清单指纹及保全 ref                | 完整原始快照已保全                |
| 主 checkout 首批 4 tracked + 14 untracked 残留          | verified | stash `1186ee89` 与保护 ref                       | 已归档；根目录保持干净            |
| 切换 main 后显露 25 个旧版本冲突副本                    | verified | 15 个等于 main；10 个等于旧保护分支 blob          | stash `6147070d` + 保护 ref       |
| 候选 inherited 997 个 tracked 冲突副本                  | verified | 974 个逐字节重复；23 个为被正式文件取代的旧快照   | 已删除；全路径后缀扫描为 0        |
| 最新 `main` 已包含设备保管生产发布关闭记录              | verified | `origin/main@7a1d2330` 与 custody release commits | 作为整合基线保留                  |
| Settings/Kiosk migration 尚未由本任务应用生产           | verified | `20260714180000` 本地 PG17 replay                 | 生产发布需 Owner D3 批准          |
| 设备保管安全 hardening migration 尚未应用生产           | verified | `20260717030000` PG17 55/55                       | 必须先于应用代码发布              |
| Kiosk 创建/审核仍有 guarded 非单事务窗口                | verified | repository 与独立审查                             | Backend + Data；独立 RPC 任务根治 |
| 根路径位于 Documents/File Provider 同步目录             | inferred | branch switch 后生成完整旧 blob 的 ` 2` 冲突副本  | 再次复发时迁移到非同步开发目录    |

## Decision and approval points

- **R3 / L2 / D2：** 本地可逆保全、语义整合、测试和专用分支提交可直接执行。
- **D3：** 两个生产 migration、`main` 推送和 Vercel 自动部署必须由 Owner 明确批准。
- **D4：** 生产数据删除、历史回填、秘密处理和删除原始保全引用仍未授权；本次只做有 stash/ref 回滚的已验证副本清理。
- 发布顺序固定为：重新 fetch → 生产预检/备份边界 → Settings migration → custody hardening migration → metadata/pgTAP 后检 → 推送应用 → Vercel/运行冒烟。

## Work packages

- WP-00：原始脏工作区清点、stash/ref/恢复目录三重保全。
- WP-01：最新 main 隔离分支重建与 SeaTable、账号、Settings、custody 语义整合。
- WP-02：Kiosk、终态打印/通知、状态机、缓存、功能开关与响应式缺陷修复。
- WP-03：向前安全迁移、动态 pgTAP、Settings migration PG17 验证。
- WP-04：全量质量门、构建、Settings/桌面 E2E、截图与独立审查。
- WP-05：生成物清理、差异包装、checkpoint、远端重检与 DB-first 发布门禁。
- WP-06：根 checkout 二次归档、tracked 冲突副本/截图清理、同步路径复发风险与最终发布候选审计。

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
