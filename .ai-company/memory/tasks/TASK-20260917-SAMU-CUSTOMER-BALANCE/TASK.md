---
schema_version: 1
task_id: "TASK-20260917-SAMU-CUSTOMER-BALANCE"
title: "WECHAT-20260917-SAMU-CUSTOMER-BALANCE 客户付款后余额显示诊断"
status: "active"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "balance-diagnostic-controller"
departments: []
created_at: "2026-09-17T17:45:58Z"
updated_at: "2026-09-19T13:48:00Z"
---
# Task — WECHAT-20260917-SAMU-CUSTOMER-BALANCE 客户付款后余额显示诊断

## Owner request

WECHAT-20260917-SAMU-CUSTOMER-BALANCE 客户付款后余额显示诊断

## Business value

使用本地证据判断客户列表待收款或待确认余额是否存在可复现缺陷

## Scope in

- 独立问题 WECHAT-20260917-SAMU-CUSTOMER-BALANCE；在当前 worktree 只读追踪付款状态、客户余额聚合、缓存失效与列表刷新。
- 使用现有本地夹具/mock 复现；无需客户资料即可证明的缺陷才做最小可逆修复与定向验证。
- 在本任务文件保存阶段、根因、修改、测试、发布判断、最小澄清和建议群回复，供来源主任务同步。
- 唯一写入者为当前窗口；canonical root `/Users/kyox215/.codex/worktrees/44ca/zip-github`。当前阶段写入仅限本 Task Memory；修复路径须在证据确认后记录。

## Scope out

- 不访问微信、不执行真实支付、不读取或修改生产客户数据。
- 不修改 schema、权限、迁移、秘密或环境变量；不直接发送群消息。
- 未持有效 Integration Lead/lease 时不得提交、集成、推送或部署；2026-09-19 Owner 已明确授权在最小文档门禁修复和全部验证通过后执行该发布链。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [ ] 核对付款状态、客户聚合、缓存与刷新路径并用本地夹具验证
- [ ] 确认缺陷时只做授权范围内最小修复；证据不足时给最小脱敏澄清
- [ ] 任务状态包含阶段、根因、修改、测试、发布判断及建议群回复

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| 反馈为付款后客户列表仍显示待收款或待确认余额 | supplied | 脱敏委派 | 需本地复现 |
| 此前相关 189 个测试通过，截图只显示记录了 5 欧元且无具体订单 | supplied, unverified here | 来源主任务摘要 | 不作付款成功证据 |
| 当前 worktree 起始干净；Registry doctor 通过 | observed | startup commands | 独立 task/run/window 已建立 |
| 另一个发布窗口持有效 integration lease | observed | Registry | 不抢占；不影响独立诊断 |

## Decision and approval points

- 本地诊断与测试属低风险；如需影响余额/支付业务规则的修改，先按已授权边界确定风险与独立审查，禁区保持不变。
- 无需重复请求已授权的本地诊断或可逆修复许可。
- 2026-09-19 Owner 明确授权：修复严格校验所需的既有文档断链，并在有效 Integration Lead/lease 下提交、推送 `main`、部署及验证；不扩大到真实支付或生产数据操作。

## Work packages

- 当前主线程直接诊断并保存证据。测试所有权：`src/features/customers/testing/payment-balance-diagnostic.test.ts`；复用现有 mock API、客户 query keys 和真实缓存失效函数，补充跨链路可执行证据。
- 已复现：零押金 €70 工单登记 €5 后，余额 €65 / payment_status=partial；金额校验错误返回 payment_status_mismatch，后续收款资格为 false。此证据尚不能认定为原群反馈的唯一根因。
- 修复合同：仅调整 `src/entities/order/model/order-calculations.ts` 的预期付款状态推导，使用已有报价/余额差额作为部分收款证据；不改金额、持久化写入、角色权限或 RPC。执行代理独占该文件及其单元测试、`src/features/orders/model/order-payment-state.test.ts`、`src/features/orders/server/order.repository.test.ts`。主线程独占客户诊断测试和本 Task Memory；不重叠。
- 金额判断具有跨模块影响，采用 gpt-6-astra/max 执行与独立专项复核。回滚为撤销本次局部源码 diff；无数据恢复操作。
- 验收：零押金部分收款仍可继续收款；未收/全额/异常/取消/退款/财务脱敏及原角色权限保持约束；客户全额清零、部分未结、同客户其他欠款、失败与重试、活跃与返回刷新均有本地证据。
- 任务未关闭前不宣称问题已解决。

## Bounded milestone

- 使用 long-running-task-guard：仅完成本问题本地诊断、最小候选和证据交接；不扩展为支付系统审计。
- Done：身份与 Context 验证、源码链路追踪、初始本地复现。Remaining：最小修复、专项复核、风险匹配测试、任务状态。Blocked：原反馈缺少能证明最终付款成功的订单状态；无生产验证授权。Next：修正金额推导并验证。
- 从 2026-09-17 17:44 UTC 计，45 分钟软检查点 / 90 分钟硬边界；最多 2 个子代理（顺序实施与审查），不递归；累计等待最多 20 分钟，每次最多 60 秒，连续两次无变化后诊断。
- 任何需要 schema、权限、环境变量或真实支付/生产数据的步骤立即停止该依赖事项并交接；测试或独立审查未通过不得标记可发布。

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
