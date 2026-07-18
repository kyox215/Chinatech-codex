# Evidence — TASK-20260718-001-order-cost-defaults

## Baseline

- Owner request authorizes scoped implementation, `main` push and application of this task's reviewed changes.
- Isolated worktree: `/private/tmp/repairdesk-order-cost-clean-20260718`.
- Branch/base: `codex/order-cost-defaults-clean-20260718` rebased on `origin/main@002852f3`.
- Original dirty checkout preserved unchanged.

## Final evidence index

| ID    | Area              | Claim                                                                            | Evidence                                                                                            | Result                                               |
| ----- | ----------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| E-001 | Git               | 完整功能和审计原子性修复已进入 `main`                                            | commits `fa6bf5c4`, `09b78664652b93ce67b92c3b00a1f0d7ac6f3739`; `git push origin HEAD:main`         | remote `main=09b78664`                               |
| E-002 | Full QA           | 代码规则、类型、单元/集成与构建无回归                                            | `npm run agents:check`; `npm run lint`; `npm run typecheck`; `npm run test`; `npm run build`        | 227 files / 1536 tests；24/24 static pages；全部通过 |
| E-003 | DB behavior       | 空值、显式零值、默认快照、稳定行、CAS、跨订单 ID、旧报价插入和幂等正确           | isolated PostgreSQL transaction suite `/private/tmp/repairdesk-order-cost-db-behavior-20260718.sql` | passed and rolled back                               |
| E-004 | Atomic audit      | 审计失败不会留下已生效授权；正常授权只写一条 before/after 审计                   | isolated PostgreSQL suite `/private/tmp/repairdesk-order-cost-permission-audit-atomic-20260718.sql` | passed and rolled back                               |
| E-005 | Supabase apply    | 生产只应用本任务迁移，历史一致                                                   | linked dry-run; `db push`; post-apply `migration list --linked`                                     | `20260718120000`、`20260718121000` local=remote      |
| E-006 | Production schema | 成本表 RLS、无 browser-role table grants、RPC 仅 service role、授权审计 RPC 原子 | `/private/tmp/repairdesk-order-cost-production-schema-after-audit-20260718.sql`                     | verified                                             |
| E-007 | Security review   | 跨店、角色、伪造 grant、成本输出隔离、原子审计无 P0/P1/P2                        | independent read-only review of final SHA `09b78664`                                                | PASS; 9 files / 128 focused tests                    |
| E-008 | Deploy            | 最终提交已部署并绑定生产域名                                                     | Vercel `chinatech-codex-lsw8sbyet-kyox120-9295s-projects.vercel.app`                                | READY; commit `09b78664`; `www.chinatech.in` aliased |
| E-009 | Feature flag      | 成本功能已在生产开启                                                             | production env name `REPAIRDESK_ORDER_COSTS_ENABLED`; exact-`1` runtime behavior observed           | enabled; value remains encrypted in CLI listing      |
| E-010 | Owner UI smoke    | 店主可维护默认成本并在新订单分开输入成本与报价                                   | production in-app browser; screenshots below                                                        | passed; screen cost `15`, quote `30`, total `€30.00` |
| E-011 | Auth/low-role     | 无登录不能读取成本；低角色不能读取/管理或通过伪造 grant 提权                     | production unauthenticated POST returned 401; permission/store/API/DB tests                         | passed; no production low-role impersonation         |
| E-012 | Runtime           | 生产冒烟期间无客户端/服务端错误                                                  | browser console; Vercel deployment error logs last 30m                                              | none                                                 |

## Visual evidence

- `evidence/production-owner-default-costs.png` — 生产店主“默认规则 → 维修项目默认成本”。
- `evidence/production-owner-new-order-cost-quote.png` — 生产店主新建订单选择“屏幕”，内部成本 `15`、客户报价 `30` 分栏显示。

- `2026-07-17T22:31:47Z` `a308c1331e` — src/server/permissions.ts; src/entities/staff/model/store-permission-policy.ts; src/features/settings/model/member-settings-editor.ts; src/features/stores/server/store.repository.ts; npx vitest run ... => 4 passed/84 passed
- `2026-07-17T22:32:53Z` `9acabb1afe` — npm run typecheck => passed; npx vitest run src/server/permissions.test.ts src/entities/staff/model/store-permission-policy.test.ts src/features/settings/model/member-settings-editor.test.ts src/features/stores/server/store.repository.test.ts => 4 passed/84 passed; git diff --check scoped files => passed
- `2026-07-18` local production-schema clone — migration SQL applied with `ON_ERROR_STOP`; transaction behavior suite passed permissions, snapshots, null/zero, CAS, forged/cross-order IDs, legacy middle insertion, cost binding and idempotent replay; transaction rolled back.
- `2026-07-18` local metadata — both cost tables have RLS; browser roles have no table grants; six cost/quote RPCs are security definer; normalization and cost-sync triggers are installed.
- `2026-07-18T02:35:23+02:00` release — remote `main@09b78664`; linked migrations through `20260718121000` aligned; Vercel production READY for the same SHA; production flag enabled; owner settings/new-order smoke and screenshots passed; unauthenticated cost read returned 401; no browser or deployment errors.
- `2026-07-18T00:38:32Z` `0ae18d4c2a` — main@09b78664652b93ce67b92c3b00a1f0d7ac6f3739；227 test files / 1536 tests；Vercel production READY。
- `2026-07-18T00:38:32Z` `08df4787d6` — Supabase local=remote through 20260718121000；强制审计失败回滚测试通过；生产店主两张截图。
