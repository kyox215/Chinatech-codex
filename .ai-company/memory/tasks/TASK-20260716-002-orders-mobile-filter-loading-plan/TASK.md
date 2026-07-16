---
schema_version: 1
task_id: "TASK-20260716-002-orders-mobile-filter-loading-plan"
title: "订单移动端筛选与队列加载性能优化实施发布"
status: "active"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["API", "DATA", "FE", "FLOW", "INT", "QA", "RELEASE", "SEC", "UX"]
created_at: "2026-07-16T07:45:13Z"
updated_at: "2026-07-16T09:15:57Z"
---
# Task — 订单移动端筛选与队列加载性能优化实施发布

## Owner request

实施已完成的订单移动端筛选与队列加载性能优化计划；完成后推送 `main`、部署应用，并实施完成本任务所需的数据库改动。

## Business value

减少订单页移动端首屏占用，为队列切换提供可信反馈，消除全店宽表读取慢路径并安全发布到生产。

## Scope in

- 从实施时最新 `origin/main` 的隔离工作树交付移动端头部密度、加载反馈与查询性能优化。
- 删除移动漏斗与灰色已选队列摘要，保留扫码、桌面筛选与全部业务队列。
- 修复队列切换 loading、错误、缓存、离线和快速连点语义。
- 优化 orders queue/list API 与 Supabase 查询，验证权限、租户隔离和性能。
- 执行完整质量门禁、截图、必要文档、数据库 apply、`main` 推送、生产部署及上线验证。

## Scope out

- 不改变订单状态机、业务队列语义、支付、库存或客户数据。
- 不引入与本任务性能证据无关的数据库对象、索引、依赖或架构重构。
- 不覆盖共享 `main` 工作区中的既有未提交改动。
- 不删除历史订单或执行不可逆数据回填。

## Hard constraints

- 单一写入者：主线程负责所有业务代码、任务记忆、提交、迁移和部署；子 Agent 只读审查。
- 数据库优先采用无迁移查询下推；只有实测与查询计划证明需要时才新增 RPC/索引。
- 数据库变更必须 dry-run/静态审查、应用后元数据/权限/查询验证，并有旧路径回滚。
- 日志、截图和任务证据不得包含秘密或完整客户 PII。
- 推送前必须重新 fetch 并证明 `origin/main` 未产生未集成的新提交。
- 部署成功必须由生产 URL、提交 SHA、真实 `/orders` 路径和错误日志证明。

## Acceptance criteria

- [x] 移动端漏斗和灰色队列摘要移除，六个业务队列完整保留
- [x] 队列切换在100ms内有反馈且错误、离线、竞态语义正确
- [x] 列表查询不再全量读取宽订单历史，结构性减负与租户隔离证据通过
- [x] lint、typecheck、test、build、移动E2E和截图证据通过
- [ ] 必要数据库改动安全应用并验证，代码推送main，生产部署与上线核验完成

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| 计划已形成并经 UX、DATA/FE、QA 只读复核 | verified | `PLAN.md`; planning checkpoint | implement from WP-00 |
| 实施基线为 `origin/main@119e4402b167` | verified at intake | `git fetch --prune`; isolated worktree | re-fetch before push |
| 共享 `main` 落后且很脏 | verified | shared worktree `git status` | never write there |
| fetch-all 是当前主要慢路径 | verified static fact | order repository/shared fetch chain | replace with measured bounded query path |
| 是否需要数据库 migration | verified no | production counts/indexes/EXPLAIN and final DATA review | no migration; observe archive p95 after release |

## Risk, autonomy, and approvals

- **R3 / L2 / D3:** 本任务包含生产发布与潜在数据库写入，按最高风险分类；主线程可在明确范围内实施和验证。
- **Owner approval recorded:** 2026-07-16，Owner 明确授权完成后推送 `main`、应用部署以及本任务所需数据库改动。
- 批准不扩大到数据删除、权限模型重写、无关迁移或其他业务模块。
- 强制独立审查：FE/UX、DATA/SEC、QA/Release；数据库对象变化需再次运行 DATA/SEC 门禁。

## Work packages

- WP-00：隔离基线、依赖/链接环境、性能与行为基准。
- WP-01：移动头部压缩、删除项与 Skeleton 同步。
- WP-02：队列 pending/error/offline/rapid-tap 状态。
- WP-03：稳定元数据缓存、请求去重和预加载减负。
- WP-04：Supabase 过滤、窄投影、计数与分页下推。
- WP-05：仅在证据需要时新增并应用 tenant-safe RPC/索引。
- WP-06：独立审查、全量门禁、移动截图和文档同步。
- WP-07：数据库应用、`main` 推送、生产部署、上线观测和回滚证据。

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
