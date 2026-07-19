---
schema_version: 1
task_id: "TASK-20260719-007-ai-natural-language-query-v3"
title: "AI 自然语言订单查询 V3 准确性、任意日期与范围上线"
status: "in_progress"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
departments: ["integration", "product", "architecture", "data", "api", "frontend", "ux", "qa", "security", "release", "documentation"]
created_at: "2026-07-19T19:09:28Z"
updated_at: "2026-07-19T20:20:03Z"
---

# Task — AI 自然语言订单查询 V3

## Owner request

完善自然语言订单查询，支持不受固定枚举限制的日期表达和组合条件；按计划实施，设置目标，完成后推送、部署并应用上线。

## Business outcome

门店员工能够用自然语言安全查询当前有权查看的订单。系统必须把原句转换为可验证的服务端查询条件，显示真实范围和精确日期，并阻止大模型添加用户没有表达的限制条件。

## Scope in

- 支持单日、绝对日期区间、开放区间、滚动 N 天/周/月/年、自然周/月/季度/年及全部历史。
- 修复“检查半年内所有的苹果15系列的手机”的设备、日期、范围和模型额外条件错误。
- 设备系列标准化和边界匹配，兼容 `Apple iPhone 15` / `iPhone 15 Pro`，排除 `iPhone 150` 与其他品牌。
- 将模型计划改为候选；最终执行参数只允许经过服务端原文验证的条件。
- 在响应中显示理解状态、全部/活跃/归档范围、精确日期、条件来源和部分结果数量。
- 合并重复零结果展示，保留结果卡页内详情与显式打开订单行为。
- 单元、集成、组件、E2E、响应式、安全、构建、发布和只读生产 smoke。
- 更新 AI 助手权威运行文档和任务证据。

## Scope out

- 新数据库表、迁移、历史数据回填或供应商采购单模型。
- 启用生产对话内写操作、付款、退款、库存扣减、客户消息或批量变更。
- 把报价项目声称为实际维修完成证据。
- 将姓名、电话、邮箱、IMEI、完整工单号发送给模型。
- 第二次真实付费 provider smoke；生产验证使用只读、无 PII 路径。

## Risk and authority

- **R4**：生产客户可见查询、外部模型计划、权限/历史范围和错误空结果会影响门店决策。
- **L1**：Owner 已明确批准本次实施、推送和部署；不授权数据库迁移、秘密变更或生产写操作。
- **D4 approved in this thread**：无迁移、只读查询的 exact-SHA 生产发布。
- 必须独立 DATA/API、FLOW/UX、QA/SEC/REL 只读复核；主线程是唯一写入和发布者。

## Acceptance criteria

- [x] 固定时间 2026-07-19 Europe/Rome 下，原句解析为 `iPhone 15` 系列、2026-01-19 至 2026-07-19、`view=all`、`financial_review=null`。
- [x] provider 恶意返回 Samsung A12、上月、金额异常、active 时，任何错误限制都不得进入 repository。
- [x] 支持绝对单日/区间、之前/之后、滚动 N 天周月年、当前/上一周期、任意月年和全部历史。
- [x] 日期显示精确 `from/to`、日期字段和 Europe/Rome 口径。
- [x] 设备系列包含 15/Plus/Pro/Pro Max，排除 Samsung、14、150。
- [x] 每次搜索显示查询范围；条件来源区分用户明确和系统默认。
- [x] 零结果只有一个状态卡；部分结果显示“显示 N / 共 M”。
- [x] 现有门店隔离、RBAC、PII 出站、限额、审计和 inline-write-off 边界不退化。
- [x] lint、typecheck、相关测试、全量测试、Webpack build 和目标 E2E 通过。
- [x] 390/430/768/1280 无横向溢出，提供脱敏截图。
- [ ] scoped commit 推送 main；Vercel exact SHA READY、正式域名绑定和只读生产 smoke 通过。

## Facts / assumptions / unknowns

| Item | Type | Evidence / handling |
|---|---|---|
| 当前日期合同只支持固定枚举 | fact | `src/features/ai-assistant/model/contracts.ts` |
| trusted 为空时会原样接受模型计划 | fact / blocker | `reconcileTrustedSearchConstraints` |
| 订单 repository 已支持可选 `dateFrom/dateTo` | fact | `OrderListFilters` / `filterOrders`，首批无需迁移 |
| 历史范围需要 `order:archive_browse` | fact | repository 服务端授权；不得静默降级 |
| “未订配件”不等于真实采购单 | fact | 保留现有订单级标记说明；采购闭环范围外 |
| 生产真实客户数据分布 | unknown | 不读取；使用合成 fixture、静态/无 PII smoke 验证 |

## Agents

- `/root/nlq_v3_api_data_review` — DATA/API/Architecture，read_only。
- `/root/nlq_v3_product_ux_review` — FLOW/UX/Frontend review，read_only。
- `/root/nlq_v3_qa_security_release` — QA/Security/Release，read_only。
- Integration Lead `/root` — 唯一写入、集成、提交、推送和部署。

## Definition of done

所有验收标准有实际证据；安全/质量门禁 PASS；生产版本与提交 SHA 一致；视觉证据、文档、任务记忆、回滚方式和残余范围完整记录。
