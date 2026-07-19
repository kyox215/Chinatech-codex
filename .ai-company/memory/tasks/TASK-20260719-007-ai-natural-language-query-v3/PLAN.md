# Plan — AI 自然语言订单查询 V3

## Architecture decision

采用 **deterministic parser + model candidate + closed-world server compiler**。模型不能生成 SQL，也不能直接决定最终查询；每个限制性字段必须由服务端从原文独立识别后才能执行。

拒绝：

- 仅改 prompt：不能保证语义值正确。
- 继续扩大正则但保留开放式 merge：仍会执行模型新增条件。
- 模型直接生成数据库查询：破坏权限、可审计性和可控成本。

## Work packages

### WP-01 — Contract and date engine

- 升级 Order Query 合同和 provider schema。
- 支持 calendar、rolling 和 absolute/open date filters。
- Europe/Rome 下处理 DST、跨年、闰日、月末。
- Exit：日期单测覆盖所有语义并通过。

### WP-02 — Semantic compiler and device guard

- 扩展组合句、全部历史、任意日期和设备系列解析。
- closed-world reconcile 丢弃模型未获原文支持的字段。
- trusted 为空且模型要求执行限制查询时返回澄清，不返回整店结果。
- Exit：精确失败原句与 adversarial provider 用例通过。

### WP-03 — Explainable compact UI

- 处理方式文案与理解状态分离。
- 可折叠查询范围显示 scope、精确日期、条件来源和纠正状态。
- 合并零结果；部分结果显示 N/M；“修改查询”只回填，不自动发送。
- Exit：组件测试与 390/430/768/1280 验收通过。

### WP-04 — Full verification and documentation

- lint、typecheck、focused/full Vitest、Webpack build、目标 Playwright。
- 独立 QA/SEC review 复核 tenant/RBAC/PII/audit/cost/inline-write-off。
- 更新权威 AI 助手说明、任务 Evidence/Checkpoint/Memory Delta。

### WP-05 — Release and observation

- fetch/rebase latest origin/main，复跑门禁。
- scoped commit，push main，无 force。
- 核对 Vercel exact SHA READY 与 production aliases。
- 只读无 PII smoke、错误日志检查、截图证据。
- 回滚：关闭 `AI_ASSISTANT_ENABLED` 或提升发布前 READY deployment；无数据回滚。

## Change budget

Allowed: `src/features/ai-assistant/**`, `src/entities/order/model/order-device-search*`, targeted `src/lib/repairdesk` contract tests if required, `tests/e2e/ai-assistant-staff.spec.ts`, AI assistant docs, this task memory, screenshots.

Forbidden: migrations, env/secrets, pricing/model budgets, store allowlists, payment/inventory/customer-message mutations, unrelated refactors.

## Stop conditions

- 需要数据库迁移或生产写操作。
- 需要处理/轮换密钥。
- 无法保持 archive/finance/tenant 权限边界。
- 关键测试或构建不能通过且无法证明与本次变更无关。
- origin/main 在发布前出现重叠修改且无法安全整合。
