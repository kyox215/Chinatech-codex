---
schema_version: 1
task_id: "TASK-20260723-002-orders-page-performance-audit"
title: "订单页面加载性能诊断与 B 方案分阶段优化"
status: "active"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["API", "DATA", "FE", "QA"]
created_at: "2026-07-23T12:32:51Z"
updated_at: "2026-07-23T13:05:00Z"
---
# Task — 订单页面加载性能诊断与 B 方案分阶段优化

## Owner request

老板反馈每次打开订单页面响应很慢，要求解释原因、提供可行优化报告，并给出可选择方案与推荐；老板已选择 B，批准分阶段实施安全的应用侧优化，并于 2026-07-23 明确批准推送 `main` 和生产部署。

## Business value

缩短订单页首次可操作时间并保持跨设备同步与权限安全

## Scope in

- 本地开发预览 `/orders` 的重复导航与可操作时间测量。
- Next.js 服务日志、客户端查询编排、订单列表数据路径与初始包依赖检查。
- 分级优化方案、预期收益、风险、验证指标和推荐顺序。

## Scope out

- 不运行生产数据库迁移；数据库侧分页需独立批准和恢复验证。
- 不把本地开发模式数据直接宣称为生产性能结论。
- 不调整老板已要求的 30 秒前台轻量版本检查。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- 后续实施必须保持订单弹窗、权限隔离、跨设备同步与移动端既有行为。

## Acceptance criteria

- [x] 提供实测加载时间与服务端证据
- [x] 区分开发模式开销与应用数据路径瓶颈
- [x] 给出分级优化选项、收益、风险和推荐
- [x] 订单详情与新建工单弹窗改为按需加载，直接路由与手机行为不变
- [x] `/orders` 首屏停止跨域预载客户、库存和前两条工单详情，保留 hover/focus/click 意图预取
- [x] 列表、workflow、options 复用已有 `orders/queue-summary`，由一次 actor 解析聚合读取
- [x] lint、typecheck、全量单测、生产 build 与定向浏览器回归通过
- [ ] 应用提交推送 `main`，Vercel 生产部署 Ready 且真实入口通过健康检查
- [ ] 数据库侧分页 RPC 完成等价性、双租户、1001+ 数据量和 EXPLAIN 验证后另行批准上线

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| 三次热导航 HTML 返回 184/202/351 ms，列表可见 5858/5467/5265 ms | observed | 浏览器计时与本地服务日志 | 已验证，平均列表就绪约 5.53 秒 |
| `orders/list-page` 三次约 2.3/2.7/2.9 秒，绝大多数在 application-code | observed | Next.js 本地服务日志 | 已验证 |
| 页面启动并发请求 onboarding、store context、workflow、settings、options、AI、customers、inventory 和 orders | observed | Next.js 本地服务日志与 Providers/Preload 代码 | 已验证 |
| 每个 RepairDesk API 请求独立重建 actor/店铺/权限上下文 | observed | `src/server/auth-context.ts`, `repairdesk-router.ts` | 已验证 |
| 订单列表先读取最多 1000 条索引，再读取当前页，并重复读取状态 bucket | observed | `order.repository.ts`, `repairdesk-shared.ts` | 已验证 |
| 订单列表静态导入 5886 行详情屏与 1891 行新建屏 | observed | `order-list-screen.tsx` | 已验证；生产包收益仍需 build/analyzer 复测 |
| 生产站真实冷/热加载指标 | unknown | 本次只测本地开发预览 | 实施前补生产 RUM/Server-Timing 基线 |

## Decision and approval points

- 老板选择 B；本轮完成前端减负并启用项目已有聚合接口，风险维持 R2 / L2。
- 不采用跨请求 actor TTL 缓存，避免权限撤销与切店延迟生效。
- 数据库 RPC、索引或生产迁移仍需独立重新分级并获得生产批准。
- Owner 已明确批准当前无数据库迁移的应用提交直推 `main` 并部署生产。

## Work packages

- 已完成：浏览器计时、服务端日志关联、前端依赖减负、已有聚合接口接入、测试与浏览器验收。
- 已真实使用 4 个只读部门子代理：FE、API/Architecture、Data、QA；主线程为唯一写入者并完成集成。
- 下一阶段：设计并影子验证 service-role-only 的显式字段分页 RPC；高级筛选在等价性未证明前继续走旧路径。

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
