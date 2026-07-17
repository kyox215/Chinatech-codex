# Checkpoints — TASK-20260718-001-order-cost-defaults

## 2026-07-18T12:00:00+02:00 — Intake and isolation

- **Completed:** Owner authorization normalized; goal created; fresh `origin/main@1f643313` isolated from the dirty root checkout.
- **Evidence:** `/private/tmp/repairdesk-order-cost-20260718`; branch `codex/order-cost-defaults-20260718`.
- **Risk:** T3 / R3; sensitive cost, role permissions, linked migration and production release.
- **Next:** establish baseline, implement additive data/permission/API slice, then UI and verification.

## 2026-07-17T22:31:47Z — 权限切片已实现：finance:cost_manage 的 owner 默认允许、manager 可显式授权、technician/sales/viewer 拒绝；成员设置选项与 feature-flag StoreContext 投影已加入。目标测试 4 文件 84 用例通过。全量 typecheck 暂因主线程独占的 StorePermissionAction union 尚未加入新 action 而失败。

- **Phase:** implementation
- **Completed/current state:** 权限切片已实现：finance:cost_manage 的 owner 默认允许、manager 可显式授权、technician/sales/viewer 拒绝；成员设置选项与 feature-flag StoreContext 投影已加入。目标测试 4 文件 84 用例通过。全量 typecheck 暂因主线程独占的 StorePermissionAction union 尚未加入新 action 而失败。
- **Next:** 主线程先在 types.ts 加 finance:cost_manage 与 StoreContext/OrderCapabilities 字段，并在 order.repository.ts 完成成本能力投影；随后重跑 typecheck 和权限切片测试。
- **Decision:** cost_manage 独立于 profit_read/aggregate_read；feature flag 必须严格等于 1。
- **Blocker:** 临时集成依赖：types.ts StorePermissionAction union 未加入 finance:cost_manage。
- **Evidence:**
  - src/server/permissions.ts; src/entities/staff/model/store-permission-policy.ts; src/features/settings/model/member-settings-editor.ts; src/features/stores/server/store.repository.ts; npx vitest run ... => 4 passed/84 passed
- **Recorded by:** cost_permission_impl
## 2026-07-17T22:32:53Z — 权限切片完成并已复验：finance:cost_manage 独立敏感授权、manager-only grant、成员权限选项、严格 feature flag StoreContext 投影均已实现。主线程已补 StorePermissionAction/StoreContext 类型；npm run typecheck 通过，目标测试 4 文件 84 用例通过。

- **Phase:** implementation
- **Completed/current state:** 权限切片完成并已复验：finance:cost_manage 独立敏感授权、manager-only grant、成员权限选项、严格 feature flag StoreContext 投影均已实现。主线程已补 StorePermissionAction/StoreContext 类型；npm run typecheck 通过，目标测试 4 文件 84 用例通过。
- **Next:** 主线程在 OrderCapabilities 类型与 projectOrderCapabilities 中加入 can_read_internal_costs/can_manage_internal_costs，随后继续成本 API、迁移和 UI 集成。
- **Decision:** cost_manage 不自动赋予 profit_read 或 aggregate_read；REPAIRDESK_ORDER_COSTS_ENABLED 仅值 1 时启用 StoreContext 成本管理能力。
- **Evidence:**
  - npm run typecheck => passed; npx vitest run src/server/permissions.test.ts src/entities/staff/model/store-permission-policy.test.ts src/features/settings/model/member-settings-editor.test.ts src/features/stores/server/store.repository.test.ts => 4 passed/84 passed; git diff --check scoped files => passed
- **Recorded by:** cost_permission_impl
