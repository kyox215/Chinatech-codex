---
schema_version: 1
task_id: "TASK-20260718-121004-ai-assistant-vision-intake-plan"
title: "RepairDesk AI 小助手与拍照入库完整规划"
status: "closed"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: "Product, UX, Architecture, API, Data, Security, QA"
created_at: "2026-07-18T10:10:04Z"
updated_at: "2026-07-18T10:19:05Z"
closed_at: "2026-07-18T10:10:04Z"
---
# 任务合同

## 目标

根据 Owner 的自然语言需求和两张业务样图，为 RepairDesk 规划一个使用 OpenAI API 的员工 AI 小助手，覆盖订单自然语言查询、设备标签照片识别、结构化资料整理和库存/订单草稿流程。

## 范围

- 现有代码、权限、库存字段、拍照/条码能力和 BFF 边界的只读盘点。
- 产品范围、用户流程、UI 状态、架构、工具合同、数据模型、隐私、安全、测试、发布和成本计划。
- 对用户样图进行脱敏业务解读，不保存或复述完整设备标识符。
- 形成可执行的分阶段计划和 Owner 决策门。

## 非范围

- 不修改业务代码。
- 不读取、创建或验证 OpenAI API Key。
- 不执行数据库迁移、生产数据写入、部署、提交或推送。
- 不把公开客户助手与员工后台首版混为同一权限模型。
- 不处理工作区中其他任务的既有改动。

## 验收标准

- [x] 给出明确的 MVP 和 Later 边界。
- [x] 覆盖订单查询与照片识别到人工确认入库的完整流程。
- [x] 覆盖 UI 状态、角色权限、失败和手工兜底。
- [x] 给出适配现有 Next.js BFF 和 RepairDesk 服务层的架构。
- [x] 识别现有字段与 RAM、多标识符、幂等草稿的模型缺口。
- [x] 覆盖 API Key、租户隔离、图片、提示注入、日志、留存和 GDPR 风险。
- [x] 给出测试、黄金集、指标、发布、回滚、工期和 Owner 决策门。
- [x] 明确本轮没有 API Key、数据库、部署或生产操作。

## 风险与权限分类

- T3：跨 Product、UX、Architecture、API、Data、Security 和 QA。
- R3：未来涉及客户订单、IMEI/序列号、第三方 AI、API Key、数据模型和生产发布。
- L2：本轮只允许可逆的只读调查和规划文档；实施与生产门禁未获授权。
- D4：是否向第三方发送客户/设备数据、购买 API、修改 schema、开放正式写入或公开客户助手均由 Owner 决定。

## 实际多 Agent 执行

- `/root/flow_ux_plan`：只读 Product/FLOW/UX 计划与验收状态。
- `/root/openai_arch_plan`：只读 OpenAI/API/Architecture 方案与可靠性策略。
- `/root/security_data_qa_plan`：只读 Data/Security/QA 数据合同、威胁模型和测试门禁。
- 主线程 Integration Lead：读取治理与项目证据、检查样图、完成官方资料核验、仲裁并集成本计划。

所有子 Agent 均为只读，没有业务代码写入、提交、推送、部署、生产 SQL 或秘密处理。

## 关闭结论

规划交付完成，结论为 `PASS_WITH_CONDITIONS`：技术上可行，建议先做员工后台的订单只读与照片转草稿；实施前仍需 Owner 批准 API 预算、密钥策略、第三方数据处理、留存、未来 schema 和任何正式写入。

主交付：`docs/AI_ASSISTANT_VISION_INTAKE_PLAN.md`。
