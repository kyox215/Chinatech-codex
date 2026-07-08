# Checkpoints — TASK-20260708-001-new-order-device-layout

## 2026-07-07T22:12:33Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.
## 2026-07-07T22:12:43Z — 新建维修订单弹窗布局已调整：客户信息下方放设备信息，故障与诊断下方保留单独手机密码区；保留之前的空客户姓名与苹果型号候选相关改动。

- **Phase:** verified_local_preview
- **Completed/current state:** 新建维修订单弹窗布局已调整：客户信息下方放设备信息，故障与诊断下方保留单独手机密码区；保留之前的空客户姓名与苹果型号候选相关改动。
- **Next:** 如继续此任务，先查看 src/features/orders/forms/new-order-customer-device-section.tsx 与 src/features/orders/screens/new-order-screen.tsx；本地预览 http://localhost:3012/orders 已用弹窗截图验证。
- **Decision:** 设备普通字段与手机密码拆分为独立导出 section，页面层按列组合，避免改保存/API逻辑。
- **Evidence:**
  - eslint targeted pass; npm run typecheck pass; screenshot screenshots/TASK-20260708-001-new-order-device-layout/new-order-device-info-left-password-center.png; browser sections customer/device-info/fault-diagnosis/device-unlock/quotation verified.
- **Recorded by:** CEO-Orchestrator
