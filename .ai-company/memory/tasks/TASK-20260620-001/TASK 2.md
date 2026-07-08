---
status: "closed"
updated_at: "2026-06-19T22:32:58Z"
closed_at: "2026-06-19T22:32:58Z"
---
# TASK-20260620-001

status: closed
owner: Integration Lead / CEO Agent
autonomy_level: L2
risk_level: R2
created_at: 2026-06-20T00:17:58+02:00

## Owner Goal

老板要求修复订单详情里的状态流转：

- 转流 / 流转状态可以手动切换到需要的状态。
- 切换后必须记录到订单记录 / 时间线。
- 点击流转时不要再弹出当前那种二级弹窗，优先在订单详情弹窗内部直接显示选项，或改成更合适的交互。

## Scope

In scope:

- 订单详情状态流转 UI。
- 手动 `transitionOrder` 校验。
- mock API 行为与测试。
- 相关 E2E 断言。

Out of scope:

- 数据库 schema / migration。
- 生产数据修改。
- WhatsApp 通知模板自动流转规则。
- 审批处理规则重写。

## Acceptance

- [x] 订单详情里的手动状态流转可选择任一启用工单状态，当前状态除外。
- [x] 状态切换后写入 `status_changed` 时间线事件。
- [x] 桌面订单详情点击“流转”后在当前详情工作面内显示选项，不再打开“状态流转”二级 Dialog。
- [x] 移动端继续使用底部 Sheet，符合现有移动详情标准。
- [x] 保留原因必填、审批处理、未结清尾款不能结案等保护。

## Outcome

Implemented and target-verified locally.

## Verification Summary

- Targeted workflow/model and mock API tests passed.
- `npm run lint`, `npm run typecheck`, `npm run test`, non-sandbox `npm run build`, and `npm run agents:check` passed.
- Targeted order detail desktop E2E passed for 1024px, 1280px, and 1440px.
- Broader `npm run test:e2e:desktop` had one unrelated `/platform` 1440px `networkidle` timeout after 8 passing tests; see `EVIDENCE.md`.

## Deliverables

- `ORDER_DETAIL_STATUS_TRANSITION_REPORT.md`
- Updated `EVIDENCE.md`, `CHECKPOINTS.md`, `HANDOFF.md`, and `MEMORY_DELTA.md`
