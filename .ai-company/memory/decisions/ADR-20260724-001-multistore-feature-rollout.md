# ADR-20260724-001: 多店铺功能采用双层发布面与 denylist 紧急隔离

- Status: accepted for application code; production activation remains approval-gated
- Date: 2026-07-24
- Decision owners: 鹤祥 / Integration Lead
- Related task: `TASK-20260724-001-multistore-feature-availability`
- Supersedes: none; complements `ADR-20260718-001`

## Context

RepairDesk 已有只在 ChinaTech 试点的 Inventory Product V2 与 AI Assistant。老板要求把成熟功能开发为所有店铺可用，但生产全量开关、外部数据处理、预算、AI 写入和数据库变更仍属于独立高风险决定。直接删除 allowlist 会把本地只读、付费模型、Vision 与未来写入错误地绑定在一起，也缺少单店紧急隔离能力。

## Decision drivers

- 所有店铺默认取得的能力必须是可回滚、低外发和最小权限的。
- 原有试点门店行为不能因兼容改造被意外降级。
- denylist 必须能在不关闭所有店铺的情况下隔离异常门店。
- 前端 capability、BFF、repository 和数据库 actor/store scope 必须保持一致。
- “代码支持全店铺”不能冒充“生产已全量开启”。

## Considered options

### Option A — 删除 allowlist

实现简单，但会把所有子能力同时放开，无法逐店回滚，也破坏现有安全与发布合同。

### Option B — `*` 作为魔法通配符

兼容字符串配置，但容易因拼写或复制错误扩大权限，无法清楚表达 denylist 优先级。

### Option C — 显式 all-stores 开关 + exact allowlist/denylist + 能力分层

配置意图清楚，可保留单店试点和紧急隔离，并允许本地只读先于外部处理推广。

## Decision

选择 Option C：

1. 共享 rollout helper 只接受精确 store ID；缺少 store ID 失败关闭，denylist 始终优先，all-stores 只有精确值 `1` 生效，`*` 没有特殊含义。
2. Inventory V2 保留所有父开关与精确 allowlist。新由 all-stores 开关扩展的门店仅允许 owner/manager 进入命令发布面；入库还必须具备 `inventory:cost_allocate`，销售要求 `inventory:sale`，这些字段权限同样约束旧 allowlist 门店。V1 保持可用。
3. AI 分成两个发布面：all-stores 只开放本地、确定性、只读订单查询；外部文字模型要求独立 exact provider allowlist。
4. Vision、draft apply、inline action 和 public assistant 不继承 all-stores 本地只读资格，继续使用更窄的试点门禁。
5. 所有生产开关、外部 provider 扩店、预算变化、数据库迁移和高风险写入仍需独立 D4 批准。

## Consequences

### Positive

- 可以先让所有店铺安全使用不外发的本地查询。
- 单店异常可以通过 denylist 快速隔离。
- 付费模型和未来写入不会因全店铺只读开关被连带开启。
- Inventory V2 扩店时默认收紧到 owner/manager，并用独立财务/销售权限保护实际命令；旧试点不能绕过字段权限。

### Negative / trade-offs

- 环境变量和 capability 状态增加，需要发布手册保持同步。
- AI 目前仍是共享全局月预算，不是每店独立月预算。
- Inventory V2 的客户端业务时间与完整历史迁移重放问题仍需后续数据治理，阻止无条件生产全量。
- 真实第二店铺的租户级 E2E/canary 仍是生产启用门禁。

## Risks and mitigations

- 配置误开：所有新开关默认 `0`/空，父开关与 denylist 优先。
- 跨店访问：客户端不能传 store scope；repository 继续使用认证 actor 的 storeId。
- 原始数据库错误泄露：V2 repository 映射为稳定 503 领域错误。
- AI PII 外发：非 provider allowlist 门店在 provider 构造与预算预留前返回本地澄清。
- 角色扩大：新增 V2 门店只允许 owner/manager 进入 rollout；入库成本再要求 `inventory:cost_allocate`，销售要求 `inventory:sale`，BFF 与 repository 双重验证。
- 资源耗尽：两个 V2 JSON 命令限制为 64 KiB，并同时验证声明长度和流式读取总量。

## Validation plan

- 共享 rollout 真值表与 exact-match/denylist 单元测试。
- Store B capability、viewer/technician 拒绝、provider 不构造/不预留、repository actor scope 测试。
- Inventory V2 安全错误映射和原始依赖错误不泄露测试。
- lint、typecheck、完整 Vitest、production build。
- 生产前用真实第二店铺账号完成桌面/移动 UI、店铺切换、无外发、审计和回滚 canary。

## Revisit conditions

- 老板批准生产全店铺开关或新增 provider 门店时。
- 需要每店独立月预算、AI 写入、Vision 全店铺或公开客户助手时。
- Inventory V2 完成客户端业务时间策略与完整迁移链治理时。
