---
schema_version: 1
task_id: "TASK-20260720-004-order-detail-alignment-polish"
title: "订单详情桌面对齐与布局秩序优化"
status: "verified"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["INT", "UX", "FE", "QA"]
created_at: "2026-07-20T00:00:00+02:00"
---

# Owner goal

根据 Owner 提供的生产截图，继续优化整个订单详情桌面工作区中宽度、列线、卡片高度、标签与内容边界的对齐关系，使各区域工整、紧凑并易于扫描。

# Business value

减少维修店前台在订单详情中辨认区块和来回滚动的成本，让负责人、供应商、记录、照片、成本与底部动作形成稳定的视觉秩序。

# In scope

- 订单详情桌面弹窗的记录与信息页布局。
- 负责人和配件供应商卡片的宽度、高度、标题、说明和控件对齐。
- 二级记录标签与选中内容的统一边界。
- 概览、照片、内部成本页的宽度与溢出回归检查。
- Playwright 桌面布局断言与脱敏截图。

# Out of scope

- 订单状态机、付款、报价计算和权限。
- API、数据库、Supabase migration 和生产数据。
- 移动端订单详情交互或 RepairOS Floating Card 结构。
- 订单列表和其他业务页面。

# Constraints

- 从最新 `origin/main` 的隔离工作树实施，保留根工作树未提交改动。
- 复用 `detailWorkspace`、现有 UI 原子和语义 token。
- 不以扩大弹窗或增加页面滚动换取对齐。
- 生产发布沿用本线程 Owner 已明确给出的“完成后推送并应用”批准。

# Acceptance criteria

1. 记录页顶部控制卡使用完整可读内容宽度，不再只占左侧并留下无意义空栏。
2. 同时出现负责人和供应商时，两卡等宽、顶部/底部对齐，内部标题、说明、控件共用同一节奏。
3. 二级标签、关键信息、通知和时间线与同一内容边界对齐。
4. 1024、1280、1440、1536、1600 桌面宽度无页面级横向溢出。
5. 概览仍能在默认桌面视口一屏呈现，底部动作区不重复金额且不遮挡内容。
6. lint、typecheck、test、build 和针对性 Playwright 布局验证通过。
7. 提供最终桌面截图，并在发布后验证生产 `/orders`。

# Agent plan

- `spawn_required: false`
- `no_spawn_reason`: 本次是单一订单详情 UI 域、同一组件文件与同一布局测试高度耦合的局部修正；并行写入会增加冲突，Owner 未要求多代理。UX、FE、QA 由主线程按顺序执行。
- `file_ownership`: Integration Lead 为唯一写入者。

# Rollback

回滚本任务提交即可恢复现有订单详情布局；无数据迁移或不可逆副作用。

# Current phase

- Implementation and quality gates are complete.
- Next action: push the rebased task branch, integrate to `main`, observe the exact production deployment, and run a production `/orders` smoke check before closing.
