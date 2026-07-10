---
schema_version: 1
task_id: "TASK-20260710-013-realtime-preload-coordination"
title: "实时刷新与智能预加载一致性协调"
status: "in_progress"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["INT", "DATA", "FE", "API", "SEC", "QA", "DOC"]
created_at: "2026-07-10T21:54:36Z"
updated_at: "2026-07-10T22:38:51Z"
---
# Task

## Owner Goal

按照已批准计划实现 RepairDesk 实时更新与智能预加载，确保预加载、实时失效、手动刷新、乐观更新、断线重连和店铺切换不会互相覆盖；完成验证后将范围内提交推送到 `main`。

## Business Result

- 前台、技师或其他同店终端更新订单后，已打开页面无需整页刷新即可获得服务器最新数据。
- 常用订单、客户、库存和新建订单入口使用同一 React Query 缓存进行内存预加载，暖缓存导航快速显示。
- 实时事件优先于旧预加载结果；旧请求不能在事件之后重新把缓存标记为新鲜。
- 移动浏览器后台恢复、网络重连和店铺切换都有可预测的重新校准与租户隔离行为。

## In Scope

- Query freshness coordinator：查询组代次、事件去重、批处理、取消优先失效、重连校准。
- 统一 feature query options，供页面和预加载共同使用。
- 登录且 active store 稳定后的有界、内存级智能预加载。
- Realtime 连接状态、认证刷新、断线恢复和紧凑状态显示。
- 订单乐观更新回滚的同步代次保护。
- 店铺切换和登出前取消旧租户请求并清理缓存/频道。
- 单元、集成、并发、请求数量、浏览器和构建验证。
- 配置、架构、发布和回滚文档同步。

## Out of Scope

- 不应用生产 Supabase migration，不修改生产 Dashboard Realtime 设置或环境变量。
- 不把业务 API、客户、订单、IMEI、付款、附件或成员数据持久化到 CacheStorage、localStorage 或 IndexedDB。
- 不引入 transactional outbox、数据库触发器或全局服务端 revision/LSN。
- 不对并发编辑做字段级自动合并；服务器 `expected_updated_at` 仍是最终冲突控制。
- 不修改无关客户搜索、账户中心、截图或其他工作区 WIP。

## Risk And Authority

- **R3:** 涉及客户数据缓存边界、Supabase 私有频道、店铺隔离和 `main` 发布。
- **L2:** Owner 已批准按计划实施并推送 `main`；低风险、可逆代码/测试/文档可执行。
- **Reserved:** 生产数据库应用、Realtime private-only Dashboard 设置和生产环境开关仍需单独明确授权及实证安全门禁。

## Acceptance Criteria

1. 同一查询键的页面读取和预加载共享请求，不建立第二套业务缓存。
2. Realtime 事件在预加载途中到达时，旧响应被取消或因代次变化而拒绝提交。
3. 活跃查询按查询组批量刷新；非活跃查询只标记过期，不造成后台全站请求风暴。
4. 重复/突发事件在有界时间窗内合并，每个活跃查询键每批最多一次重新获取。
5. 本地乐观更新期间的远程事件被合并；发生新事件后不得恢复旧快照。
6. 网络恢复、页面重新可见或频道重新订阅后，当前活跃域只校准一次。
7. 店铺切换和登出先取消旧租户请求，再移除缓存和订阅；旧店铺事件被忽略。
8. Realtime payload 保持 metadata-only，敏感字段和额外字段继续拒绝。
9. 业务 API 响应明确 `no-store`，Service Worker 不缓存认证业务响应。
10. 暖缓存导航、双会话更新、离线恢复和移动/桌面状态 UI 有自动或浏览器证据。
11. scoped lint、typecheck、相关测试、全量测试、build 通过后才允许推送。
12. 只提交本任务文件并确认 `origin/main` 指向新提交。

## Rollback

- 独立 `NEXT_PUBLIC_REPAIRDESK_PRELOAD_ENABLED` 可关闭预加载，Realtime 继续工作。
- 现有 `NEXT_PUBLIC_REPAIRDESK_REALTIME_ENABLED` 和 `REPAIRDESK_REALTIME_BROADCAST_ENABLED` 可分别关闭客户端和服务端实时广播。
- 协调器保持与现有 query keys/API 兼容，代码回滚不涉及数据回填或删除。
