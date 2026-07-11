---
schema_version: 1
task_id: "TASK-20260711-002-order-detail-preload-skeleton"
title: "订单详情预加载与订单客户全框架骨架屏"
status: "in_progress"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["INT", "FE", "UX", "QA"]
created_at: "2026-07-10T23:31:51Z"
updated_at: "2026-07-11T00:22:02Z"
---

# Task

## Owner Goal

实现订单详情分层预加载，移除订单/客户页面首次进入时的单行加载文字，改为完整 RepairOS 骨架屏；确保预加载、Realtime 失效、后台刷新和店铺切换不互相覆盖。验证完成后范围化推送 main。

## Scope In

- 订单和客户路由、冷查询加载状态使用同构全框架骨架。
- 订单详情 page/dialog 使用稳定骨架外壳和加载期间可见关闭入口。
- 统一订单详情 query options，供页面读取和预取共同使用。
- 有界预取调度：启动订单/客户优先、订单详情首屏少量预取、hover/focus/pointer-down 意图预取。
- 所有详情预取通过 QueryFreshnessCoordinator 的 orders.all 组。
- 单元、组件、竞态、请求数量、构建和浏览器响应式验证。

## Scope Out

- 不修改数据库 schema、Supabase migration、生产 Realtime 配置或环境开关。
- 不新增批量详情 API、生产依赖或持久化业务缓存。
- 不预取整页 50 条订单详情。
- 不混入原始工作区 SeaTable、账户中心或其他 WIP。

## Change Contract

- 单一业务代码写入者：Integration Lead。
- 实施工作树：/private/tmp/repairdesk-order-detail-preload-skeleton-20260711。
- 分支：codex/order-detail-preload-skeleton-20260711，基于 origin/main@e286bbdc。
- 允许模块：src/app/orders、src/app/customers、src/features/orders、src/features/customers、src/features/preload、store shell 终态恢复、相关测试、文档与本任务记忆。
- 禁止区域：数据库迁移、服务端权限、支付、消息发送、生产配置。

## Acceptance Criteria

1. /orders、/customers 冷启动不显示可见单行加载文字，路由和查询阶段使用同构全框架骨架。
2. 热缓存导航不显示骨架；后台刷新保留已有内容，不退回冷加载状态。
3. 订单详情 fresh cache 点击不重复发送 order/get；in-flight 预取和页面读取共享请求。
4. 首屏详情预取有界：正常网络最多 2 条、并发 1；Save-Data/2G/offline 为 0。
5. hover 100ms、focus/pointer-down 触发预取；离开取消尚未启动任务。
6. Realtime 或 store epoch 变化后旧预取不能写入缓存。
7. 订单详情 Dialog 加载第一帧有可见关闭入口，外壳尺寸稳定。
8. 390、430、1024、1440 视口无页面级横向溢出，并产出结果截图。
9. lint、typecheck、全量 test、build 和相关 Playwright 通过后才能推送。

## Rollback

- NEXT_PUBLIC_REPAIRDESK_PRELOAD_ENABLED=0 可关闭全部推测预加载。
- 订单详情预取保持独立代码路径，可单独回滚，不影响骨架屏。
- 本任务无数据迁移、回填或生产数据回滚。

## Business Result

- 订单和客户首次冷进入直接显示完整 RepairOS 工作区骨架，不再显示单行加载文字。
- 订单列表挂载后只由一个 store-scoped 调度器预热当前首屏最多两条详情，并发固定为一条。
- hover、focus、pointer-down 会复用同一详情查询；队列有界，focus-out 和 pointer leave 会取消未开始任务。
- Realtime、手动刷新和店铺切换继续通过 query/store epoch 阻止旧详情响应覆盖新状态。
- 热缓存和后台刷新保留当前列表，客户筛选刷新以紧凑 spinner 提示，不退回冷骨架。
- 平台管理员、待开通和店铺读取失败不再无限显示骨架，并提供可执行恢复入口。
