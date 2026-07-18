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

## 2026-07-18T02:35:23+02:00 — Production release and closeout

- **Phase:** closeout
- **Completed/current state:** additive cost schema and atomic permission-audit migrations are applied; implementation and hardening commits are on remote `main`; production feature flag is enabled; final Vercel deployment is READY; owner UI and unauthenticated access smoke passed.
- **Evidence:** `09b78664`; linked history through `20260718121000`; 227 files / 1536 tests; 24-route build; Vercel `chinatech-codex-lsw8sbyet-kyox120-9295s-projects.vercel.app`; two production screenshots under `evidence/`.
- **Decision:** close as delivered. Do not create a production low-role test identity only for smoke; retain automated role/forged-grant/API/DB proof as the safer isolation evidence.
- **Residual:** later profit reporting, supplier/inventory linkage, exports, multi-currency and historical backfill remain explicitly out of scope.
- **Next:** monitor ordinary production use; rollback path is remove `REPAIRDESK_ORDER_COSTS_ENABLED` and redeploy, retaining additive tables/audits.
- **Recorded by:** IntegrationLead

## 2026-07-18T00:38:32Z — 订单内部成本、默认成本与权限审计原子性已完成生产发布；main、linked Supabase 与 Vercel 均已核验。

- **Phase:** closeout
- **Completed/current state:** 订单内部成本、默认成本与权限审计原子性已完成生产发布；main、linked Supabase 与 Vercel 均已核验。
- **Next:** 执行正式 close-task，提交并推送关闭证据，然后核验最终部署。
- **Decision:** 以功能开关作为首选回滚；不为低权限冒烟创建或冒充生产账号。
- **Evidence:**
  - main@09b78664652b93ce67b92c3b00a1f0d7ac6f3739；227 test files / 1536 tests；Vercel production READY。
  - Supabase local=remote through 20260718121000；强制审计失败回滚测试通过；生产店主两张截图。
- **Recorded by:** IntegrationLead

## 2026-07-18T00:38:32Z — Task closeout

- **Status:** closed
- **Outcome:** 订单成本、店铺默认成本、权限隔离和原子审计已发布；生产店主冒烟、无登录 401、完整质量门禁均通过。
- **Residual risks:** 利润报表、库存供应商联动、成本导出、多币种和历史回填仍在本任务范围外；真实低权限生产账号未被冒充测试。
- **Follow-up:** 正常监控生产使用；异常时移除 REPAIRDESK_ORDER_COSTS_ENABLED 并重新部署，再以前向迁移修复。
- **Closed by:** IntegrationLead
