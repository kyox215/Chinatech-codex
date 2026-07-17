---
schema_version: 1
task_id: "TASK-20260717-005-store-identity-hardcode-removal-plan"
title: "移除客户可见 Chinatech 硬编码并建立多店铺输出身份"
status: "closed"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L1_for_production_customer_output"
owner: "IntegrationLead"
departments:
  ["Product", "Architecture", "Frontend", "API", "Data", "Security", "QA", "Documentation"]
created_at: "2026-07-17T18:45:36Z"
updated_at: "2026-07-17T19:55:26Z"
closed_at: "2026-07-17T19:55:26Z"
---

# Task - 移除客户可见 Chinatech 硬编码并建立多店铺输出身份

## Owner Goal

解决不同店铺对外客户消息、链接、打印、页面和法务文本中错误显示 Chinatech 信息的问题。项目不应把 Chinatech 地址、名称、邮箱或域名当作全局默认值；也不得把老板自己的 ChinaTech 店铺资料写入默认值、示例、mock、文档模板或平台品牌。每个店铺必须使用自己的店铺资料，ChinaTech 信息只能作为 ChinaTech 这个店铺自己的数据存在。

## Business Value

- 防止 xutech 或未来合作店向客户发送 Chinatech 地址、签名或链接预览，避免信任损害和隐私/法律风险。
- 把 RepairDesk 从单店硬编码产品推进到独立合作店铺平台。
- 建立可测试的客户可见输出身份规则，避免以后新功能继续引入店铺身份污染。

## Scope

In scope:

- 客户可见 WhatsApp/SMS 文案和 `wa.me` 打开流程。
- 工单、客户、二维码、打印页和收据中的链接生成。
- 店铺资料、消息签名、打印页脚、联系方式、对外域名的来源规则。
- 登录页、侧边栏、onboarding placeholder、mock/demo 数据中的 Chinatech 硬编码治理。
- 所有默认值、示例值、测试 fixture、mock/demo 数据、文档样例改用中性占位资料，不使用老板真实 ChinaTech 店铺信息。
- 历史 `store_settings` / `message_templates` 中旧 Chinatech 默认值的只读审计和预览式修复方案。
- Buyback 回收报价/法务文本的租户身份方案，但不直接重新启用高风险证据功能。
- 测试、文档和验收规则。

Out of scope until separately approved:

- 生产数据库 DML 修复、迁移 apply、部署、推送。
- 购买或切换公共域名。
- 自动发送 WhatsApp Business API；当前仍按 `wa.me` 打开并记录。
- 重新启用 buyback restricted evidence/finalize。
- 删除或重写历史迁移文件。

Release authorization note: the Owner later explicitly approved the scoped migration apply,
`main` push, and production deployment. Production DML/backfill, domain purchase/switching,
and buyback legal reactivation remained out of scope throughout the release.

## Hard Constraint

- Do not write the Owner's real ChinaTech store information into code defaults, example values, mock/demo data, test fixtures, docs templates, placeholder text, platform branding, or seed data.
- ChinaTech's real name/address/email/domain may appear only where the record explicitly belongs to the ChinaTech store, in migration/history evidence, or in owner-approved production data.
- Neutral examples must use fictional non-real identities such as `Demo Repair Store`, `Centro Riparazioni Roma`, `Via Esempio 12`, `owner@example.com`, or reserved test domains.

## Verified Facts

- 多店铺方向已批准：共享数据库、严格 `store_id` 隔离、店铺资料差异通过 settings/roles/feature flags 而不是代码 fork。
- 当前已有运行时防护：`resolveStoreOutputIdentity` 会阻断非默认店铺使用旧 ChinaTech/Floridia 身份。
- 当前订单通知 `orderUrl` 来自 `window.location.href`，客户消息 `appOrigin` 来自 `window.location.origin`，会把当前访问域名带入外发消息。
- 登录页和侧边栏仍有客户/员工可见的 Chinatech 文案。
- Buyback 法务文本和版本常量仍硬编码 Chinatech；相关敏感功能当前按项目记忆保持 feature-off。
- 早期迁移里 `store_settings` 默认值写死 ChinaTech/Floridia；不得通过编辑历史迁移解决，应新增前向修复或运行时防护。

## Risk Classification

Overall risk: R3.

Reasons:

- 涉及客户外发消息和链接，错误会直接影响真实客户沟通。
- 涉及多租户店铺身份和隐私边界。
- 涉及法务/隐私文本时不能用可变设置直接替代法律主体。
- 生产数据修复和域名切换需要 Owner 明确批准。

Autonomy:

- L2: 本地只读审计、规划、测试草案、低风险 UI 文案去品牌化。
- L1/D3 approval required: 生产数据修复、客户外链域名策略、Buyback 法务主体策略、部署发布。

## Acceptance Criteria

1. 非 Chinatech 店铺发送 WhatsApp/SMS、打印工单、打印收据、生成二维码、客户消息时，不出现 Chinatech、Floridia、Viale Vittorio Veneto、kyox120 或 chinatech.in，除非该店铺明确配置为自己的信息。
2. 客户外链由统一的 store-aware helper 生成，不再由组件直接使用 `window.location.href` / `window.location.origin` 作为业务身份。
3. 所有客户可见输出在店铺资料缺失、加载失败、store context mismatch、旧身份污染时 fail closed，并提示去设置修复。
4. 店铺设置 owner/manager 可以维护当前店铺对外名称、地址、电话、WhatsApp、邮箱、签名、打印页脚和可选公共链接域名。
5. 历史污染数据必须先生成预览报告，Owner 批准后才能执行生产修复。
6. Buyback 法务文本在没有每店铺法律主体合同前保持 feature-off 或 Chinatech-only，不得让其他店铺用 Chinatech legal docs。
7. 默认值、示例、mock、测试 fixture 和文档样例不能包含老板真实 ChinaTech 店铺资料。
8. 增加测试证明 Store A 的输出身份不会泄露 Store B 或 Chinatech 默认资料。

## No-Spawn Reason

This turn is a planning-only owner request. No real sub-agents were spawned. Implementation should use read-only Product/Architecture/Security/Data/QA review before production-impacting phases.
