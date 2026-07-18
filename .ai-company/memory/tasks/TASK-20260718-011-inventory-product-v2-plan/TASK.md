---
schema_version: 1
task_id: "TASK-20260718-011-inventory-product-v2-plan"
title: "RepairDesk 库存商品 V2 重建与正式上线规划"
status: "in_progress"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["Architecture", "DATA", "FLOW", "QA", "SEC", "UX", "DOC", "Release"]
created_at: "2026-07-18T17:00:00Z"
updated_at: "2026-07-18T19:03:13Z"
---
# Task — RepairDesk 库存商品 V2 重建与正式上线规划

## Owner request

先完成审计规划；Owner 于 2026-07-18 批准按规划设定目标并开始执行，完成验证后推送 `main`。退役当前库存商品交互，建设可正式运行的手机/型号/客户/售卖闭环；保留 AI 功能继续介入；手机端和电脑端统一、简洁、面向新手、一步一步完成。

## Business outcome

在最新 `origin/main` 的隔离工作树内实现 V2 的可发布代码、additive migration、统一跨端流程、AI 草稿边界、测试与运行手册；验证通过后只提交任务范围并直接推送 `main`。

## In scope

- 当前库存/客户/设备/销售/回收/AI 能力只读审计。
- 手机、型号/规格、库存身份、客户、销售、付款、保修和售后目标流程。
- 移动/桌面响应式与完整 UI 状态。
- V1 替换、迁移、对账、灰度、回滚和退役计划。
- 当前官方行业、意大利保证/商业凭证和 OpenAI 数据边界研究。

## Out of scope / retained gates

- 物理删除任何历史表、字段、附件、回收证据或客户/财务历史。
- 生产数据库 migration apply、真实客户数据读取、付费 AI 调用、手工生产部署或客户沟通；推送 `main` 后项目既有自动部署属于 Owner 明确发布请求的预期结果，但 V2 默认关闭。
- 把本计划当成法律或税务意见。

## Hard constraints

- 旧库存数据、回收证据、客户关系和审计不可随 UI 退役删除。
- AI 任务、计划、Secret 与未来实现目录属于禁止删除范围。
- 当前 dirty/diverged 工作区不得用于后续实现；实施需隔离工作树。
- 模型不直接正式写入；所有正式动作服务端鉴权、幂等、审计和人工确认。

## Acceptance criteria

- [x] 有证据的现状功能和主要缺口清单。
- [x] 产品目录/型号/单台设备/数量库存/销售/付款目标数据模型。
- [x] 手机录入、客户、检测、上架、销售、售后主流程与异常边界。
- [x] AI 保留和介入合同。
- [x] 移动/桌面统一规范、状态和 viewport 验收。
- [x] V1→V2 迁移、切换、回滚与最终删除门禁。
- [x] 生产发布、法律/税务/隐私审批点。
- [x] Owner 已批准进入执行并在完成后推送 `main`。
- [x] V2 additive schema、约束、RLS/Grants、幂等与原子销售合同完成。
- [x] 服务端、客户端、mock、types 与 feature flag 合同一致。
- [x] 新手六步录入、来源主体和原子销售入口跨端可用；检测/上架继续复用 V1 兼容工作流。
- [x] 既有 AI 拍照识别可应用到 V2 草稿，且不能直接正式写入。
- [x] lint、typecheck、test、build、迁移静态/隔离验证和浏览器截图通过。
- [ ] 任务范围提交并在远端未漂移前推送 `main`。

## Risk and autonomy

- R4：库存/销售/付款/客户 PII/生产迁移/历史删除/AI 第三方处理与发布。
- L2：允许隔离工作树内的可逆代码、测试、文档和 additive migration 文件；主线程为唯一写入者。
- D4：生产 migration、V1 写入关闭、物理删除、财政/保修政策、AI 真实数据、生产发布。

## Deliverables

- `docs/INVENTORY_PRODUCT_V2_RELAUNCH_PLAN.md`
- `.ai-company/memory/tasks/TASK-20260718-011-inventory-product-v2-plan/EXECUTION_CONTRACT.md`
- V2 schema/API/UI/tests/runbook and visual evidence.

## Definition of done for execution

任务范围代码已验证并推送 `main`；生产数据库 apply 与部署若未获得独立批准，必须保持未执行并写成条件关闭，不得伪装已上线生产。
