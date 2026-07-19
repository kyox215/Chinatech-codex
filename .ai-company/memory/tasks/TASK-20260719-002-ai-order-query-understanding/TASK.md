---
schema_version: 1
task_id: "TASK-20260719-002-ai-order-query-understanding"
title: "修复 AI 小助手金额异常查询与自然语言误判"
status: "conditional"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["product", "architecture", "data", "security", "frontend", "qa", "documentation"]
created_at: "2026-07-19T08:00:00Z"
updated_at: "2026-07-19T08:24:39Z"
---

# Task — 修复 AI 小助手金额异常查询与自然语言误判

## Owner request

“这个是本地 ai 还是接入了 api 的线上 ai 在处理？目前很多问题都不能理解或者没结果，帮我解决。”

Owner 随后明确授权复用现有本地 `OPENAI_API_KEY`；不授权创建新密钥、生产发布、数据库变更或扩大真实客户数据外发。

## Verified root cause

- 当前是混合架构：无歧义固定意图走本地确定性路由，其他合规文本由 OpenAI Responses API 选择严格只读工具。
- OpenAI 当前只能选择 `search_orders`、`get_order_summary` 或 `clarify_order_query`。
- `search_orders` 没有“金额异常”参数，因此“有没有什么是金额异常的”会被错误转换成普通关键词搜索；仓库找不到客户、设备或订单号包含“金额异常”的工单，随后返回误导性的补充客户/设备提示。

## Objective

让 AI 小助手能够准确理解中文、意大利语和英语的“金额异常/金额不一致”查询，返回当前员工有权查看范围内需要人工财务核对的工单；同时阻止无财务汇总权限的角色通过该查询推断整店财务状态，并让无结果文案说明实际检查内容。

## Scope in

- 订单金额一致性纯规则及测试。
- 订单列表的受权限保护财务复核过滤器。
- AI 严格工具参数、确定性意图路由、OpenAI 规划提示和 fake provider。
- 金额异常结果/空态文案及回归测试。
- 本地质量、安全、移动端浏览器与截图验证。

## Scope out

- 自动修改工单金额、付款记录或数据库。
- 将订单金额、客户标识或完整订单数据发送给 OpenAI。
- 新模型、密钥、预算、依赖、migration、feature flag 或生产部署。
- 利润、成本、跨店聚合或自由 SQL/报表能力。

## Product rules

- “金额异常”仅表示需要人工核对，不表示欺诈、会计结论或自动修复。
- 当前规则检查：非有限/负金额；定金加尾款超过报价；`is_paid` 与尾款是否结清矛盾；付款状态与系统金额口径矛盾。
- OpenAI 只产生严格枚举参数；实际筛选在 RepairDesk 服务端、当前门店和当前 actor 权限范围执行。
- 金额异常列表属于整店财务推断，只允许 `finance:aggregate_read`；卡片继续不显示具体金额。
- 默认检查活跃工单；用户明确要求历史/全部时仍遵守现有归档权限。

## Risk and authority

- **Local implementation: R3 / L2 / D2.** 代码可逆且无生产写入，但新增财务推断过滤器和 AI 公共工具契约，需权限与回归门禁。
- **Production release: R3 / L1 / D4.** 本任务没有生产发布授权；push/deploy/真实数据 smoke 需单独批准。
- **No-spawn reason:** 用户未要求多代理；本任务为单一写入者的有界修复，当前开发者规则禁止未获请求时启动子代理。所列部门均为 considered / not spawned，由主线程按相应 Skill 执行。

## Acceptance criteria

- [x] “有没有什么是金额异常的”不调用 OpenAI，直接形成金额异常过滤查询。
- [x] 常见中文、意大利语、英语金额异常表达均映射为严格工具参数。
- [x] 金额一致性规则覆盖正常、负数、超额、结清标记和付款状态矛盾。
- [x] 只有具备 `finance:aggregate_read` 的 actor 可执行金额异常列表；其他角色 fail closed。
- [x] OpenAI 工具描述明确区分业务概念过滤与客户/设备关键词，未知分析请求优先追问。
- [x] 结果卡不包含金额、电话、IMEI 或其他新增敏感字段。
- [x] 无异常时明确说明已检查的金额口径，不再要求补充客户/设备。
- [x] 相关单测、lint、typecheck、全量 test、build 和移动端流程按可用环境验证并记录证据。

## Conditional closeout

本地候选、自动化门禁和手机端可视验证全部完成；状态保持 `conditional`，唯一未完成事项是生产发布与登录态生产复验。该 D4 步骤未获本任务授权，生产仍运行发布前版本。

## Architecture decision

选择“严格 AI 参数 + 受权限保护的仓库过滤器”。拒绝仅改 prompt（没有真实查询能力）和在 AI service 分页扫描整店金额（延迟、容量和权限边界更差）。不新增依赖或数据库对象。

## Rollback

回退本任务对金额规则、订单过滤器、AI 契约/路由/文案/测试的单一提交即可；无数据回滚、密钥或环境恢复动作。

## Stop conditions

- 发现索引数据不足以可靠计算规则且需要 migration。
- 现有权限无法区分单单金额读取与整店财务推断。
- 需要向 OpenAI 发送真实金额、客户 PII 或扩大模型/预算才能实现。
- 最新 `origin/main` 在实施期间变化并与目标文件冲突。
