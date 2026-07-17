---
schema_version: 1
task_id: "TASK-20260718-001-order-cost-defaults"
title: "订单内部成本与默认成本权限化实施发布"
status: "active"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2_code_L1_production_owner_approved"
owner: "IntegrationLead"
departments:
  ["Product", "UX", "Frontend", "Backend", "Data", "Security", "QA", "Release", "Documentation"]
created_at: "2026-07-18T12:00:00+02:00"
updated_at: "2026-07-17T22:32:53Z"
---

# Task

## Owner goal

在新建维修订单的故障与报价项目中加入内部成本；允许最高权限用户维护每个维修项目的默认成本；低权限员工完全看不到成本字段。完成验证后推送 `main`，应用本任务必要的 Supabase 与生产发布改动。

## Business value

- 店主可在报价时同时掌握配件/维修成本与客户报价。
- 高频维修项目可以自动带入店铺默认成本，减少重复录入。
- 成本数据与面向员工、客户、打印、导出和普通订单接口隔离。
- 历史订单保存成本快照，不被后续默认值变更反向改写。

## In scope

- 统一维修项目目录与稳定 `catalog_key`、`line_id`。
- 订单行成本与店铺默认成本的独立数据模型、迁移、服务和审计。
- `finance:cost_manage` 敏感权限及 Owner/Manager 授权边界。
- 新建订单、订单详情修正入口、设置默认成本与成员权限界面。
- 服务端默认成本应用、空值与显式零值区分、低于成本警告。
- 桌面/移动、授权/未授权、跨店、离线与撤权回归测试。
- linked Supabase dry-run/apply/元数据核验、Git main 推送、Vercel 发布与生产冒烟。

## Out of scope

- 完整利润报表、供应商/库存自动联动、成本导出、多币种和历史回填。
- 在现有未加密 IndexedDB 中保存成本。
- 将成本加入普通订单 DTO、列表、打印、WhatsApp、客户导出、Realtime 或通用审计正文。
- 删除成本表或回写历史订单；回滚以功能关闭和前向修复为主。

## Owner authorization

- 2026-07-18：Owner 明确要求按既定计划设定目标、开始执行、完成后推送 `main` 并应用改动。
- 授权覆盖本任务经审查的代码、必要 linked migration 与相应生产发布；不覆盖无关 migration、破坏性数据操作、秘密处理或客户外部通信。

## Risk and autonomy

- 可逆代码/UI/测试/文档：R2-R3 / L2。
- 成本权限、linked migration、main 推送与生产发布：R3 / L1，必须串行、精确锁定目标并保留前后证据。
- 出现跨租户可见、旧客户端绕权、无回滚路径、migration 历史漂移或无关 pending migration 时停止发布。

## Acceptance

- 授权 Owner 或获授权 Manager 可输入订单行成本并维护默认成本；其他角色成本 UI、请求与返回均不存在。
- `finance:cost_manage` 只能由 Owner 授予 Manager；不自动获得完整利润报表权限。
- 空成本保持未知，显式 `0` 保持零成本；默认成本仅在新订单创建时复制为快照。
- 自定义项目默认空；报价低于成本仅警告，不阻断。
- 低权限新建订单由服务端应用默认成本，客户端无法读取；旧客户端提交成本被 403 拒绝。
- 低权限修改报价不会删除既有成本；跨店请求失败；普通订单、打印、导出与审计不泄漏成本。
- 设置、新建订单、详情修正和权限界面覆盖桌面与移动状态；未授权员工保持当前布局。
- lint、typecheck、相关测试、全量 test、build、权限/迁移/视觉验证通过。
- linked migration 先 dry-run，只应用本任务 migration，随后核验 migration history、表、约束、RLS、grants 和 RPC 执行权。
- 快进推送 `main`，Vercel READY，生产登录保护与授权/未授权冒烟通过。

## Execution model

- Integration Lead：唯一业务代码、迁移、Git、Supabase 与发布写入者。
- Product/UX、Data/Security、Permissions/QA：先前方案为约束，实施后只读复核。
- 隔离 worktree：`/private/tmp/repairdesk-order-cost-clean-20260718`。
- 分支：`codex/order-cost-defaults-clean-20260718`，重放基线 `origin/main@002852f3`。

## Change contract

- 优先新增独立成本表与专用 API，不把敏感成本嵌入 `fault_prices`。
- 只为 `fault_prices` 增加非敏感的 `line_id` 与 `catalog_key`。
- 迁移 additive、无历史回填、RLS 开启，`anon`/`authenticated` 无直接表权限，RPC 仅 `service_role`。
- 默认功能在数据、权限与接口全部就绪后再开放；发现不兼容时保持界面关闭并做前向修复。
- 发布采用 migration-first：linked dry-run/apply 与元数据核验完成后，才部署新代码并开启功能开关。
