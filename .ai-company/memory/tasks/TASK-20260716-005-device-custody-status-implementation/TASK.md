---
schema_version: 1
task_id: "TASK-20260716-005-device-custody-status-implementation"
title: "设备留机与保管状态端到端实施"
status: "active"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["API", "ARCH", "DATA", "DOC", "FLOW", "INT", "QA", "RELEASE", "SEC", "UX"]
created_at: "2026-07-16T18:23:37Z"
updated_at: "2026-07-16T23:25:22Z"
---
# Task — 设备留机与保管状态端到端实施

## Owner request

按照已批准的留机/未留机计划设定目标并执行，完成后安全集成并推送 `main`。

## Business value

让新建工单和工单详情准确记录客户是否留机，消除错误退还、交付、取机提醒和解锁凭据风险，并安全推送 main。

## Scope in

- 实施规划任务 `TASK-20260716-004-device-left-status-plan/PLAN.md` 的 WP-00 至 WP-05。
- 新增 nullable `device_custody_status` 数据契约、向前 migration、共享类型、API/schema/repository、审计事件与缓存失效。
- 新建工单增加显式 `已留店 / 未留店`，默认已留店；“留存”改为“随附物品”；未留机不保存解锁凭据。
- 工单详情增加状态 Badge、确认收机/确认归还/补录动作、版本冲突、权限、移动 Sheet 和桌面 Dialog。
- 修正取消、完成、取机逾期、任务引导、队列、打印、离线草稿、导入导出、mock/fixtures 和文档。
- 执行定向测试、全量质量门禁、真实浏览器响应式验证和截图。
- 精确提交任务文件，重新 fetch 远端后安全集成并推送 `main`。

## Scope out

- 不批量回填或猜测旧订单，不删除列/数据，不重写历史 migration。
- 不扩大角色权限，不改变快修/送修、报价、支付或外修的既有业务定义。
- 不处理无关的重复 Agent 名称、旧表 RLS、恢复基线或其他技术债。
- 生产 Supabase migration、生产部署和外部客户沟通保持 D3 门禁；“推送 main”不自动等于数据库或部署授权。

## Hard constraints

- 主线程是唯一代码写入者；子 Agent 只读，不得 Git/DB/发布写入。
- 实施分支已安全 rebase 到 `origin/main@184672fe`；最终只暂存明确任务文件，并在发布前再次 fetch。
- 新列必须先 nullable add、再设置未来默认 `with_shop`；旧行保持 `NULL`，不设置 `NOT NULL` 或索引。
- 不得把新列加入缺列静默剥离清单；数据库缺失时必须显式失败。
- 服务端权限、租户隔离、状态门禁和解锁凭据清除是权威边界；UI 隐藏不算授权。
- 行更新、凭据清除和事件必须具备可证明的一致性；若现有补偿不足，暂停并提出事务 RPC Plan Delta。
- 不声称未执行的测试、migration、deploy 或生产验证；截图不得包含真实 PII、IMEI 或解锁凭据。

## Acceptance criteria

- [x] 新建工单可显式选择已留店或未留店，默认已留店且状态完整持久化
- [x] 工单详情可审计地确认收机、确认归还或补录，版本冲突和权限正确
- [x] 未留机订单不会产生虚假退还、交付、取机逾期、催取机或解锁凭据
- [x] 旧订单保持未知，不批量伪造历史；迁移兼容旧行并采用保留 nullable 列的应用回滚策略
- [x] 定向测试、lint、typecheck、全量 test、build、E2E 与截图证据通过
- [ ] 范围内变更安全集成并推送 main；生产迁移和部署按明确批准门禁执行

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| 当前没有独立保管字段；现有“留存”是随附物品 | verified | 规划 `EVIDENCE.md` 与当前代码 | implement independent contract |
| 实施分支已 rebase 到当时最新 `origin/main@184672fe` | verified | rebase、人工解四处订单模块冲突、重新验证 | re-fetch before release |
| 当前未提交文件全部属于留机规划/任务记忆 | verified | `git status`, `git diff --name-only` | preserve and stage exactly |
| 生产 Supabase 广泛 parity/recovery 仍有开放冲突 | verified | `OPEN_CONFLICTS.md` CONFLICT-20260619-006 | no production apply without new gate/approval |
| 推送 main 会自动触发 Vercel 生产部署 | verified/live | Vercel 项目只读配置与最近 main 发布记录 | main push 必须和 DB migration 串行发布 |
| 行更新、清密、交接事件需原子一致 | verified | `repairdesk_apply_order_atomic_mutation` migration、repository 与回归测试 | production apply pending D3 approval |
| 生产库尚无 `device_custody_status`，且离线创建 RPC 不存在 | verified/live | Supabase 只读 schema/RPC 复核 | migration 前禁止 push main；离线创建保持 flag off/fail closed |

## Decision and approval points

- **R3 / L2:** schema、订单状态机、物理保管证据和解锁秘密使实现按最高影响分类；本地可逆实施和测试已由 Owner 的“开始”授权。
- **D2:** 主线程可决定最小代码结构、测试、文案微调和兼容实现，只要不偏离批准计划。
- **D3:** 生产 migration、生产 deploy、权限政策变化、历史批量修复必须另行明确批准。
- **D4:** 数据删除、不可逆回填和秘密处理未授权。
- 强制独立审查：DATA/API/ARCH、SEC/QA、UX/FLOW；发布前重新 fetch 并串行化 Git/DB/deploy。

## Work packages

- WP-00：恢复计划、锁定基线、冲突、字段语义、权限和迁移顺序。
- WP-01：migration、类型、schema/router、repository、事件、完成/取消/状态门禁与测试。
- WP-02：新建双选、解锁联动、离线创建与测试。
- WP-03：详情 Badge、Sheet/Dialog、专用交接动作、冲突/权限/时间线。
- WP-04：列表、取机/队列/任务引导、打印、导入导出、mock/fixtures、文档。
- WP-05：定向/全量测试、独立复核、E2E、响应式截图和回滚审查。
- WP-06：精确提交、远端重检和推送 main；生产 migration/deploy 保持独立门禁。

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
