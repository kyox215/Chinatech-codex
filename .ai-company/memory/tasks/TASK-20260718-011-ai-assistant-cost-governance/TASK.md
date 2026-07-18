---
schema_version: 1
task_id: "TASK-20260718-011-ai-assistant-cost-governance"
title: "RepairDesk AI 小助手 Phase 3A 成本治理与上线准备"
status: "active"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["API", "Architecture", "DATA", "DOC", "FLOW", "QA", "Release", "SEC"]
created_at: "2026-07-18T17:11:44Z"
updated_at: "2026-07-18T18:00:04Z"
---

# Task — RepairDesk AI 小助手 Phase 3A 成本治理与上线准备

## Owner request

在已完成并部署、但默认关闭的 Phase 0–2 基础上，规划下一个阶段并立即开始执行。结合 Owner 对 10 家门店成本的关注，本阶段先完成成本治理、零模型路径和 live-provider 上线准备，再进入完整持久草稿数据扩展。

## Business value

把 10 家店的 AI 成本控制在可测、可限、可停的范围，并在不开放真实生产调用的前提下完成上线准备。

## Scope in

- 将原 Phase 3 拆为本任务的 **Phase 3A 成本治理与上线准备**，以及后续独立的 **Phase 3B 持久草稿/RAM/多标识符扩展**。
- 对明确订单号和高置信常见筛选建立确定性解析路径；服务端权限、门店隔离和业务查询保持不变，确定性命中不调用模型。
- 建立 `order_text` / `inventory_vision` 分场景配额、请求预算、模型层级、输出 Token、deadline、AbortSignal、安全标识和审计成本合同。
- 建立 provider usage 到估算成本的纯函数与 allowlist 审计字段；不记录消息、图片、工具参数、订单内容、PII 或完整标识符。
- 设计 durable quota repository，并准备仅限 AI 用量/预留/结算的 additive Supabase migration 草案；包含原子预留、幂等、RLS、最小 Grants、索引，以及保留/回滚/schema-clone/linked dry-run 计划。
- 使用 fake provider、合成数据和默认关闭功能旗标完成单元、合约、集成、安全和全量质量验证。
- 完成独立 Architecture/API、Data/Security、Product/QA/Release 复核、文档、检查点、发布和回滚批准包。

## Scope out

- 不同步、读取或输出 OpenAI API Key；不发起任何真实 OpenAI 请求。
- 不把真实客户消息、订单正文、IMEI、设备照片或 OCR 全文发送给第三方。
- 不安装 `openai`、`sharp` 或其他新生产依赖，除非 Owner 单独批准。
- 不应用 Supabase migration，不写生产数据，不启用任何 production `AI_*` / `OPENAI_*` 变量。
- 不在本任务持久化聊天、图片、识别草稿、RAM、多标识符或字段复核；这些属于 Phase 3B。
- 不实现或激活 Phase 4 回收/新工单正式预填和 Phase 5 公开客户助手。
- 不让模型获得正式写入、SQL、通用 CRUD、付款、权限或状态转换工具。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- 只在干净隔离分支 `codex/ai-assistant-cost-governance-20260718` 写入；不得触碰 Owner 的脏 `main` 工作区。
- 主线程是唯一写入者；三个部门子 Agent 均为 read_only。
- 预算 `$50/月`、每店 `20 文字 + 10 图片/天`、全局 `300 provider calls/天` 是推荐提案，不因“开始执行”自动升级为付费生产批准。
- 所有新配置缺失或无效时必须 fail closed；手工订单查询和手工入库始终可用。
- 每个微阶段开始前重读本计划和 master plan，结束后运行最窄测试并记录检查点。

## Acceptance criteria

- [x] 明确订单号及锁定的高置信订单筛选可在服务端确定性解析，并证明命中时 provider 调用数为 0、provider 配额不被消耗。
- [x] 不确定输入仍走既有 provider planner；无权限、跨店、无结果和依赖失败语义不回归。
- [x] AI 请求具有分场景限额、模型层级、成本估算、输出上限、deadline/AbortSignal 与 privacy-preserving safety identifier 合同。
- [x] provider usage 只写入 Token/估算微美元/模型和策略版本等 allowlist 聚合审计，不写敏感正文。
- [x] durable quota 接口与 additive migration 草案覆盖原子预留、结算、释放、幂等、RLS、最小 Grants 和索引；文档明确保留/回滚计划与未实施边界；本任务不得 apply。
- [x] 所有真实付费调用、密钥同步、图片外发、生产迁移和 public activation 继续 fail-closed。
- [ ] 定向测试、lint、typecheck、全量 test、Webpack build、相关 fake E2E、安全/数据复核和检查点均有真实证据。

## Facts, assumptions, and unknowns

| Item                                                      | Type                        | Evidence                                                                       | Status / next action                             |
| --------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------ |
| Phase 0–2 已 default-off/fake/page-memory 发布            | verified                    | prior task `HANDOFF.md`, `CLOSEOUT_REPORT.md`, production evidence E-033–E-039 | 本任务从 exact `origin/main@f9b0ee8c` 开始       |
| 当前生产没有 `AI_*` / `OPENAI_*` 变量                     | verified at prior closeout  | prior E-037                                                                    | 发布前重新核验；不能假定永久不变                 |
| 新 API Key 存在于 Owner 工作区 ignored `.env.local`       | verified presence only      | 安全无输出检查；未读取值                                                       | 本任务不复制到隔离树或 Vercel                    |
| 当前 quota 为单进程 Map                                   | verified                    | `src/features/ai-assistant/server/quota.ts`                                    | 只能用于 fake/default-off；live hard gate        |
| provider contract 已报告 usage，但 openai provider 未实现 | verified                    | `provider.ts`, `provider-factory.ts`                                           | 可先扩展纯合同和测试，不做真实调用               |
| fake provider 已含确定性订单解析                          | verified                    | `testing/fake-provider.ts`                                                     | 移到 provider 之前的保守服务端路由以节省真实调用 |
| OpenAI API 与 Codex Pro 订阅分账                          | verified current 2026-07-18 | OpenAI Codex/API pricing docs                                                  | 生产预算仍需数值批准                             |
| 推荐预算与模型组合                                        | proposed                    | Owner 成本讨论：$50 hard cap；nano / 4o-mini / mini 分层                       | 仅写入计划/默认关闭示例，首次付费前批准          |
| 真实图片第三方处理/DPA/ZDR/EU/删除                        | unknown / D4                | prior approvals register                                                       | 不阻塞 fake/default-off 实施；阻塞 live          |
| production migration apply                                | unknown / D4                | master plan and prior handoff                                                  | 只准备文件与非生产验证，不 apply                 |

## Decision and approval points

- **分类：R4 / L2。** 最高风险来自真实第三方处理、生产凭据、付费预算、跨租户 quota、生产数据库与部署；当前代码切片通过 default-off、fake、无外发和无 apply 将实际执行风险降到可逆范围。
- **D1/D2 可执行：** 计划/ADR、纯函数、确定性解析、接口、fake provider、单元/合约测试、默认关闭 env 示例、迁移草案、schema-clone 测试和文档。
- **D3 独立复核后：** dormant code release、非生产合成数据 E2E、只包含未应用 migration 文件的提交。
- **D4 Owner 保留：** `$50` 或其他真实预算、模型/依赖采购、使用现有 key、Vercel Secret 同步、真实文本/图片外发、DPA/ZDR/region/删除、linked production migration apply、任何 AI/public production flag 激活。
- 生产部署属于外部变更；只有既有“最终推送部署”授权仍适用且本次 release 保持 dormant、通过全部门禁时才执行。任何 live activation 均需新的执行级批准。

## Work packages

- WP-3A0 Context/Contract：恢复证据、官方资料、风险/批准包、三组只读审查、完整阶段合同。
- WP-3A1 Zero-cost Routing：保守确定性订单解析、provider bypass、审计与 quota 顺序调整、回归测试。
- WP-3A2 Cost/Runtime Policy：分场景策略、模型层级、Token/成本估算、deadline/AbortSignal、安全标识、fail-closed 配置。
- WP-3A3 Durable Quota Draft：repository contract、原子预留/结算/释放、additive SQL、RLS/Grants/索引/保留/回滚；不 apply。
- WP-3A4 Verify/Review：定向与全量门禁、恶意/并发/配额测试、独立复核、文档和检查点。
- WP-3A5 Dormant Release：scope-only commit/push/deploy 批准包、exact-SHA smoke、env-name review、观察和 rollback；不启用 AI。

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
- 若 D4 门禁仍未批准，任务只允许以 `conditional` 关闭 default-off safe slice，不能声称 live AI 或 Phase 3B 已完成。
