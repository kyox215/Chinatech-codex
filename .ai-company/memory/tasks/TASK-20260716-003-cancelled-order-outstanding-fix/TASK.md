---
schema_version: 1
task_id: "TASK-20260716-003-cancelled-order-outstanding-fix"
title: "取消工单仍计入客户待收的全链路修复"
status: "completed"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["flow", "ux", "frontend", "data", "api", "security", "qa", "release"]
created_at: "2026-07-16T17:42:34Z"
updated_at: "2026-07-16T19:23:54Z"
---
# Task — 取消工单仍计入客户待收的全链路修复

## Owner goal

按照已批准的精确计划实施：两张 €70 工单中取消一张后，所有客户有效汇总只显示 €70；检查相关 SQL、服务端、Mock、导出、UI、缓存和收款门禁，完成验证后推送 main 并应用安全 migration。

## Approved business contract

- 取消订单保留报价、订金、余额、事件和历史证据，不清零原始金额。
- `status = cancelled` 或 `exception_status = cancelled` 时，对累计订单额、待收、有效/重复/在修统计贡献为 0。
- 历史工单仍保留取消记录；取消行显示“已取消 · 不计入待收”。
- 取消订单禁止继续普通收款；直接 API/RPC 请求也必须失败且零写入。
- Realtime 不是正确性依赖；本地 mutation 成功后主动刷新客户与订单缓存。

## Scope in

- 客户 list/detail/fallback/Mock/export/KPI/filter 的统一聚合口径。
- 客户与订单取消历史的状态感知金额文案。
- 订单创建、编辑、收款、流转/取消后的 customers/orders cache invalidation。
- 服务端与支付 RPC 的取消单收款保护。
- 前向、可逆、无数据回填的 Supabase migration。
- 单元、repository/mock、router、SQL contract、E2E/视觉、全量质量门禁。

## Scope out

- 通用完成单纠错、重新打开、软作废、物理删除和新权限体系。
- 退款、冲销、客户余额、历史账务批量修复。
- 改写已应用历史 migration、依赖升级或无关重构。
- 共享脏工作区和设置中心任务的任何改动。

## Acceptance criteria

- [x] 两张 €70、取消第二张：历史 2、有效 1、累计 €70、待收 €70。
- [x] 仅 legacy/canonical 任一取消标记时均被排除。
- [x] 取消单不进入未结清筛选、KPI 或重复客户判断。
- [x] 列表、详情右栏/总览、移动、历史、设备、客户导出同义。
- [x] 取消单 UI 不显示可收待收；直接收款 API/RPC 被拒且零写入。
- [x] 关闭 Realtime 后取消成功仍立即刷新客户详情和列表。
- [x] SQL、TypeScript fallback、Mock parity 金额差异不超过 €0.01，计数一致。
- [x] 租户隔离、财务脱敏、函数 grants/search_path 保持安全。
- [x] `agents:check`、lint、typecheck、test、build、相关 E2E/SQL 验证通过。
- [x] 生成脱敏桌面/移动截图，提交并推送 main；migration dry-run/apply/post-check 有证据。

## Risk and authority

- 总体 R3 / L2；Owner 本轮原文授权实施、main 推送及门禁通过后的数据库应用。
- 生产 migration 只允许窄、可逆、无数据回填的函数/RPC 变更；任一安全、质量、远端 parity 或发布锁门禁失败即停止。
- 生产数据修复、退款/冲销、删除和过度扩大的终态生命周期仍未授权。

## File ownership

- 主线程：唯一写入者、集成、测试、提交、推送和数据库发布。
- `/root/finance_data_security_review`：DATA/API/SEC，只读。
- `/root/finance_ui_cache_review`：FLOW/UX/FE，只读。
- `/root/finance_qa_release_review`：QA/ARCH/RELEASE，只读。

## Definition of done

验收矩阵、三路独立只读复核、视觉证据、数据库前后验证和 main 发布均已完成。生产未改写历史订单或 ledger；关闭结论为通过。
