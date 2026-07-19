---
schema_version: 1
task_id: "TASK-20260719-004-ai-processing-mode-usage"
title: "AI 查询处理方式选择与门店使用量"
status: "in_progress"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L1"
owner: "IntegrationLead"
departments: ["product", "architecture", "frontend", "backend", "security", "qa", "documentation"]
created_at: "2026-07-19T09:30:38Z"
updated_at: "2026-07-19T11:00:59Z"
---
# Task — AI 查询处理方式选择与门店使用量

## Owner request

在 AI 小助手搜索输入区提供“本地处理 / 大模型理解”选择，并在设置中增加 AI 使用量查看。

### Owner follow-up and release approval — 2026-07-19

“帮我加上在这里,直接在当前页面,就是跟对话这里也加上使用量的情况,然后再部署应用上线。”

该原文批准本任务在补齐对话内使用量后执行 scoped commit、push 和生产部署；不批准数据库 migration、密钥/预算/模型变更或扩大外发数据范围。

## Business result

员工可在发送前明确控制查询是否调用外部大模型；获授权的店铺负责人可查看当前门店的大模型请求、Token 与费用估算，且不能跨店读取或从客户端指定模型、预算、密钥和门店。

## Scope in

- AI 工单查询输入区增加两种明确处理方式。
- 本地处理只使用确定性规则与 RepairDesk 查询，不调用 provider 或占用大模型预算。
- 大模型理解强制走现有受控 provider、出站策略、配额、预算和审计链路。
- 增加当前门店、最近 30 天的大模型请求、Token、预留费用及已结算估算费用视图。
- 设置页访问权限复用 `finance:aggregate_read`，后端从 actor 的当前门店取 scope。
- 复用现有 `ai_assistant_usage_buckets`；不新增数据库表或 migration。
- AI 对话面板内增加紧凑的今日使用量摘要，复用同一聚合 API，不复制计费口径。
- 完成发布前门禁、推送、生产部署、真实路由冒烟与观察。

## Scope out

- OpenAI 组织级 Usage/Costs API、组织管理员密钥或跨项目账单。
- 允许客户端选择具体模型、价格、预算、Safety ID 或门店 ID。
- 修改 AI 功能旗标、allowlist、现有密钥或生产数据。
- 数据库 migration、密钥、模型、预算、AI allowlist、外发审批或生产数据变更。

## Product rules

- 输入区默认选择“本地处理”；切换只影响下一次提交，不代表离线可用。
- “本地处理”无法确定理解时返回可操作的澄清，不静默升级到大模型。
- “大模型理解”即使句子可被本地规则识别，也按用户选择进入受控 provider 路径。
- 旧客户端未发送处理方式时保留现有“本地优先、必要时 provider”兼容行为。
- 使用量只展示聚合指标，不展示 prompt、回复、客户 PII、订单号、actor 或请求指纹。
- 费用标明为美元估算；进行中的预留费用与已结算估算费用分开显示。
- 对话内摘要只向具备 `finance:aggregate_read` 的当前门店成员显示；其他 AI 用户不发起用量请求，也不显示财务聚合。
- 对话内状态覆盖加载、成功、零用量、失败降级和刷新；用量读取失败不能阻断本地或大模型查询。

## Acceptance criteria

- [x] 本地/大模型选择在 390px 与桌面输入区可见、可操作、状态清晰。
- [x] 本地模式对已支持查询 provider=0、budget=0；未知语句返回澄清。
- [x] 大模型模式强制经过 provider、出站检查、配额/预算和审计。
- [x] 请求 schema 拒绝未声明值，并保持旧客户端兼容。
- [x] 设置总览与导航出现“AI 使用量”，仅有 `finance:aggregate_read` 的当前门店成员可访问。
- [x] 用量接口不接受 store ID，返回今天与近 30 天的门店聚合，并带 no-store 缓存头。
- [x] 空、加载、失败、零用量、预留中和正常数据状态完整。
- [x] lint、typecheck、相关测试、全量测试、build 和浏览器截图通过。
- [x] 对话面板在 390px 与桌面端显示今日模型请求、额度、Token 和费用估算，无横向溢出。
- [x] 无财务聚合权限时不显示摘要且不请求用量 API；读取失败时 AI 查询仍可使用。
- [x] 对话提交成功后刷新当前门店用量，设置页与对话页口径一致。
- [ ] 最终 diff、安全、全量质量门禁、浏览器截图、生产冒烟和观察通过。
- [ ] exact commit 已推送并部署到生产，远端 `main`、部署 SHA 和本地候选一致。

## Delivery state

- Owner 已批准在补齐对话内使用量后 push/deploy；当前进入实现与发布门禁。
- 未新增 migration，未修改密钥、生产配置或生产数据。
- 生产发布前应在目标环境复核现有 AI live 门禁与 `finance:aggregate_read` 权限投影。

## Risk and authority

- Local implementation: R3 / L2 / D2；涉及外部 AI 出站选择、费用聚合和权限，但为可逆代码且无 DDL。
- Production release: R3 / L1 / D4；Owner 已于 2026-07-19 明确批准本任务的 scoped push/deploy，任何 migration、密钥/预算/模型或外发范围变化仍需新批准。
- No-spawn reason: Owner 未要求多代理，当前开发者规则禁止未获明确请求时启动子代理；FLOW/UX/FE/API/SEC/QA/RELEASE 为 considered / not spawned，主线程为唯一写入者并串行执行复核。

## Rollback

回退本任务的请求字段、路由分支、设置分组、聚合读取和测试提交；无数据库、数据、密钥或配置回滚。
