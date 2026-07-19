---
schema_version: 1
task_id: "TASK-20260719-003-ai-device-search-relevance"
title: "修复 AI 设备型号查询返回无关工单"
status: "pending_release_approval"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["product", "architecture", "backend", "security", "qa", "documentation"]
created_at: "2026-07-19T08:58:00Z"
updated_at: "2026-07-19T09:18:35Z"
---
# Task — 修复 AI 设备型号查询返回无关工单

## Owner report

生产手机端输入“苹果15”，AI 小助手返回一张 `SAMSUNG A12` 工单。

## Business result

品牌/型号查询只能返回设备标签与查询相符的工单；不得因为型号中的短数字命中客户电话、IMEI 或工单号。

## Scope in

- 独立的设备品牌/型号结构化查询字段及服务端筛选。
- 中/英/意常见品牌别名和紧凑型号输入的本地确定性解析。
- OpenAI planner 防止丢弃品牌、把型号退化成短数字搜索。
- 生产截图原句的 repository/service/E2E 回归。

## Scope out

- 修改工单、客户、设备或生产数据。
- 新模型、密钥、预算、依赖、migration 或 feature flag。
- 模糊语义向量搜索、跨店搜索或扩大卡片字段。
- 未经新批准的 push/deploy。

## Product rules

- “苹果15”归一为设备查询 `iPhone 15`；“三星A12”归一为 `Samsung A12`。
- 设备查询只匹配 `device_label`，采用忽略空格/大小写/常见分隔符的包含匹配。
- 品牌与型号必须共同保留；不能只留下 `15`、`12` 等短数字。
- 没有匹配时返回零结果，不用客户电话、IMEI 或订单号补足结果。
- 查询仍受当前 store/actor/active/archive 权限边界约束，结果卡不新增 PII。

## Acceptance criteria

- [x] “苹果15”走本地确定性路径，provider=0，形成 `device_search=iPhone 15`、`search=null`。
- [x] Apple iPhone 15 命中，Samsung A12 即使电话/IMEI含 `15` 也不命中。
- [x] 紧凑/空格/大小写以及中文、英语、意大利语查询有回归。
- [x] OpenAI 严格 schema 必须携带 nullable `device_search`，并明确禁止只保留型号数字。
- [x] repository 与 mock API 行为一致；无权限/租户/归档边界不放宽。
- [x] lint、typecheck、相关测试、全量测试、build 和 390px 流程有实际证据。

## Risk and authority

- Local implementation: R3 / L2 / D2；可逆代码修复，但影响生产 AI 搜索相关性与敏感标识匹配。
- Production release: R3 / L1 / D4；必须在本任务质量/安全证据后由 Owner 单独批准。
- No-spawn reason: Owner 未要求多代理，开发者规则禁止未获请求时启动；所有部门为 considered / not spawned，主线程为唯一写入者。

## Rollback

回退本任务的设备查询字段、解析、筛选和测试提交；无数据、数据库、密钥或配置回滚。
