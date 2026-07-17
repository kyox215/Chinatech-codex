## 2026-07-17T18:04:32Z — 修复设备保管二次修改 stale updated_at：设备保管 mutation 成功后同步写回订单读缓存中的 updated_at、device_custody_status、delivered_at 和解锁字段；二次提交优先读取最新缓存版本，保留服务端乐观锁与权限规则。改动文件：src/features/orders/api/cache-sync.ts、src/features/orders/api/cache-sync.test.ts、src/features/orders/screens/order-detail-screen.tsx。

- **Phase:** verifying
- **Completed/current state:** 修复设备保管二次修改 stale updated_at：设备保管 mutation 成功后同步写回订单读缓存中的 updated_at、device_custody_status、delivered_at 和解锁字段；二次提交优先读取最新缓存版本，保留服务端乐观锁与权限规则。改动文件：src/features/orders/api/cache-sync.ts、src/features/orders/api/cache-sync.test.ts、src/features/orders/screens/order-detail-screen.tsx。
- **Next:** 重新核对 git diff/status，排除无关未跟踪目录，提交本任务代码、截图和任务记忆，push main。
- **Decision:** 采用前端缓存同步修复，不放宽 expected_updated_at 乐观锁，不改 Supabase migration/RPC；终态修正不伪造 delivered_at。
- **Evidence:**
  - 已运行：npm run test -- src/features/orders/api/cache-sync.test.ts；npm run test -- src/features/orders/testing/mock-api.test.ts -t custody；npm run typecheck；npm run lint；npm run test；npm run build（沙箱失败后非沙箱通过）；Playwright device-custody-order-flow 3/3 通过；截图 screenshots/device-custody-second-edit-mobile-ord_1.png。
- **Recorded by:** IntegrationLead
