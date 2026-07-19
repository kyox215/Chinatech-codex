---
schema_version: 1
task_id: "TASK-20260719-004-ai-processing-mode-usage"
title: "AI 查询处理方式选择与门店使用量"
status: "pending_release_approval"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["product", "architecture", "frontend", "backend", "security", "qa", "documentation"]
created_at: "2026-07-19T09:30:38Z"
updated_at: "2026-07-19T10:10:23Z"
---
# Task — AI 查询处理方式选择与门店使用量

## Owner request

在 AI 小助手搜索输入区提供“本地处理 / 大模型理解”选择，并在设置中增加 AI 使用量查看。

## Business result

员工可在发送前明确控制查询是否调用外部大模型；获授权的店铺负责人可查看当前门店的大模型请求、Token 与费用估算，且不能跨店读取或从客户端指定模型、预算、密钥和门店。

## Scope in

- AI 工单查询输入区增加两种明确处理方式。
- 本地处理只使用确定性规则与 RepairDesk 查询，不调用 provider 或占用大模型预算。
- 大模型理解强制走现有受控 provider、出站策略、配额、预算和审计链路。
- 增加当前门店、最近 30 天的大模型请求、Token、预留费用及已结算估算费用视图。
- 设置页访问权限复用 `finance:aggregate_read`，后端从 actor 的当前门店取 scope。
- 复用现有 `ai_assistant_usage_buckets`；不新增数据库表或 migration。

## Scope out

- OpenAI 组织级 Usage/Costs API、组织管理员密钥或跨项目账单。
- 允许客户端选择具体模型、价格、预算、Safety ID 或门店 ID。
- 修改 AI 功能旗标、allowlist、现有密钥或生产数据。
- 未经 Owner 新批准的 push、deploy 或生产配置变更。

## Product rules

- 输入区默认选择“本地处理”；切换只影响下一次提交，不代表离线可用。
- “本地处理”无法确定理解时返回可操作的澄清，不静默升级到大模型。
- “大模型理解”即使句子可被本地规则识别，也按用户选择进入受控 provider 路径。
- 旧客户端未发送处理方式时保留现有“本地优先、必要时 provider”兼容行为。
- 使用量只展示聚合指标，不展示 prompt、回复、客户 PII、订单号、actor 或请求指纹。
- 费用标明为美元估算；进行中的预留费用与已结算估算费用分开显示。

## Acceptance criteria

- [x] 本地/大模型选择在 390px 与桌面输入区可见、可操作、状态清晰。
- [x] 本地模式对已支持查询 provider=0、budget=0；未知语句返回澄清。
- [x] 大模型模式强制经过 provider、出站检查、配额/预算和审计。
- [x] 请求 schema 拒绝未声明值，并保持旧客户端兼容。
- [x] 设置总览与导航出现“AI 使用量”，仅有 `finance:aggregate_read` 的当前门店成员可访问。
- [x] 用量接口不接受 store ID，返回今天与近 30 天的门店聚合，并带 no-store 缓存头。
- [x] 空、加载、失败、零用量、预留中和正常数据状态完整。
- [x] lint、typecheck、相关测试、全量测试、build 和浏览器截图通过。

## Delivery state

- 本地候选已实现并验证，等待 Owner 单独批准 push/deploy。
- 未新增 migration，未修改密钥、生产配置或生产数据。
- 生产发布前应在目标环境复核现有 AI live 门禁与 `finance:aggregate_read` 权限投影。

## Risk and authority

- Local implementation: R3 / L2 / D2；涉及外部 AI 出站选择、费用聚合和权限，但为可逆代码且无 DDL。
- Production release: R3 / L1 / D4；需要 Owner 在质量与安全证据后单独批准。
- No-spawn reason: Owner 未要求多代理，开发者规则禁止未获请求时启动；所有部门为 considered / not spawned，主线程为唯一写入者并执行产品、架构、安全和 QA 复核。

## Rollback

回退本任务的请求字段、路由分支、设置分组、聚合读取和测试提交；无数据库、数据、密钥或配置回滚。
