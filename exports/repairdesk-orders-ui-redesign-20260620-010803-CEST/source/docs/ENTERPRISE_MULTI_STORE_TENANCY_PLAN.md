# RepairDesk 企业级多店铺与性能完善计划

## Summary

本计划把当前 RepairDesk 从“单店内部系统”升级为“可供多个独立店铺账号使用的多租户 SaaS 后台”。

- 默认架构采用单 Supabase/Postgres 项目中的强租户隔离：`stores` + `store_memberships` + 所有业务表 `store_id`。
- 每个登录账号可以拥有或加入一个或多个店铺；首次使用时自动创建自己的店铺空间，并成为 owner。
- 所有查询、写入、审计、消息模板、系统设置、库存、工单、客户、员工权限都必须按 `store_id` 隔离。
- 对外表现是“每个用户/店铺有自己的独立数据库空间”；底层第一版不为每个店铺创建物理数据库，避免成本、迁移、备份、运维和查询治理复杂度爆炸。
- 如果未来有企业客户要求强监管隔离，再扩展为“每企业一个 Supabase project / Postgres database”的高级部署模式。

## Current Findings

### Local Browser Check

- 本地已有 dev server 在 `http://127.0.0.1:3010`。
- 未登录访问 `/` 会跳转到 `/login?next=%2F`，符合业务页登录保护。
- 登录页可正常渲染：标题、邮箱、密码、登录按钮都可见。
- 1280px viewport 下登录页 `scrollWidth === innerWidth`，没有页面级横向溢出。
- Headless 浏览器捕获到一个开发态 HMR WebSocket 错误，这通常与当前 dev server/代理响应有关，不属于生产功能错误，但需要在后续本地验证里复查。
- 因当前没有可用员工账号，本轮无法真实点击进入业务页；后续 E2E 需要测试账号或 mock-auth 测试模式。

### Codebase Shape

- Next.js App Router：`src/app/*` 薄路由，页面主体在 `src/features/*/screens`。
- 客户端通过 `@/lib/repairdesk/api` 调用 `/api/repairdesk/*`。
- 后端统一入口在 `src/server/api/repairdesk-router.ts`，真实数据由 service role Supabase client 访问。
- 登录上下文在 `src/server/auth-context.ts`：用 Supabase SSR `getClaims()` 获取用户，再查 `staff_profiles`。
- 现有 `staff_profiles` 是全局员工档案；还没有店铺维度的会员关系。
- 现有业务表基本没有 `store_id`，包括 customers、devices、repair_orders、order_events、message_logs、CRM 表、inventory 表。
- 刚加入的 `store_settings` / `message_templates` 仍是单店思路，必须在多店铺方案中改为 `store_id` scoped。

## Architecture Decision

### Default: Shared Database, Strict Tenant Rows

第一版采用共享数据库 + 行级租户隔离：

```txt
auth.users
  -> staff_profiles            全局用户档案
  -> store_memberships         用户属于哪些店铺、店铺内角色
stores
  -> customers
  -> devices
  -> repair_orders
  -> order_events
  -> message_logs
  -> customer_*
  -> inventory_*
  -> store_settings
  -> message_templates
  -> audit_logs
```

理由：

- 成本低、迁移简单、备份统一、功能迭代快。
- 可以用 Postgres 索引、唯一约束、RLS、服务端权限共同保证隔离。
- 对当前代码改造最可控，不需要动态创建 Supabase project、动态连接池或跨库迁移系统。
- 适合维修店 SaaS 第一阶段。

### Enterprise Option: Physical Isolation

未来若客户要求强隔离，可支持：

- 每企业一个 Supabase project / Postgres database。
- 中央 control-plane 保存 tenant -> project ref / database url。
- 应用根据登录用户解析 tenant 后动态选择连接。
- 需要独立的迁移编排、备份恢复、监控账单和连接池管理。

这一模式不是第一版默认，因为会显著增加发布和维护复杂度。

## Tenant Model

### New Tables

#### `stores`

- `id uuid primary key`
- `name text not null`
- `slug text unique not null`
- `owner_user_id uuid references auth.users(id)`
- `status text check ('active','suspended','deleted')`
- `plan text default 'starter'`
- `timezone text default 'Europe/Rome'`
- `currency_code text default 'EUR'`
- `created_at`, `updated_at`

#### `store_memberships`

- `id uuid primary key`
- `store_id uuid references stores(id) on delete cascade`
- `user_id uuid references auth.users(id) on delete cascade`
- `email text not null`
- `display_name text`
- `role text check ('owner','manager','technician','sales','viewer')`
- `status text check ('active','invited','inactive')`
- `created_at`, `updated_at`
- unique `(store_id, user_id)`
- index `(user_id, status)`

#### `store_invitations`

- `store_id`
- `email`
- `role`
- `token_hash`
- `expires_at`
- `accepted_at`

第一版可先由管理员手动创建会员；邀请流作为 Phase 4。

## Data Isolation Plan

### Tables That Must Gain `store_id`

- `customers`
- `devices`
- `suppliers`
- `repair_orders`
- `order_events`
- `message_logs`
- `customer_tags`
- `customer_tag_assignments`
- `customer_interactions`
- `customer_followups`
- `inventory_items`
- `inventory_quality_checks`
- `inventory_transactions`
- `inventory_events`
- `store_settings`
- `message_templates`
- `audit_logs`

### Store Scoped Constraints

- customers: unique `(store_id, phone_raw)` instead of global phone uniqueness.
- devices: index `(store_id, customer_id)`, optional unique `(store_id, serial_or_imei)` only if business wants strict IMEI uniqueness.
- repair_orders: unique `(store_id, public_no)`.
- suppliers: unique `(store_id, name)` or `(store_id, short_name)`.
- message_templates: unique `(store_id, domain, kind, channel, language)`.
- store_settings: unique `(store_id)`.

### Public Numbers

Do not use one global sequence for all stores in the long term.

Options:

- First version: keep global `public_no`, add unique `(store_id, public_no)` and accept gaps.
- Better: add `store_counters(store_id, counter_type, next_value)` and allocate order/inventory numbers per store in a transaction.
- Future: prefix public numbers with store slug, e.g. `CT-FLO-000123`.

## Auth And Tenant Context

### Actor Shape

Extend `AuditActor` into tenant-aware context:

```ts
interface RequestActor {
  id: string;
  email: string;
  displayName: string;
  globalRole?: StaffRole;
  storeId: string;
  storeName: string;
  storeRole: StoreRole;
  stores: Array<{ id: string; name: string; role: StoreRole }>;
}
```

### Active Store Resolution

Server source of truth:

1. Supabase `getClaims()` identifies user.
2. Query active memberships from `store_memberships`.
3. Read requested store from signed cookie `repairdesk_store_id` or request header.
4. Validate requested store belongs to the user.
5. If absent, use the user's first active store.
6. If no membership exists, create a personal store and owner membership.

The browser may remember selected store, but the server never trusts it without membership validation.

## Repository Rules

Every repository method must receive tenant context or derive it from actor:

```ts
listOrders(filters, actor)
getOrder(id, actor)
createOrder(input, actor)
```

Every query must include `.eq("store_id", actor.storeId)`.

Every insert must set `store_id: actor.storeId`.

Every join should ensure related rows are same-store by schema constraints or explicit checks.

Dangerous pattern to avoid:

```ts
supabase.from("repair_orders").select("*").eq("id", id)
```

Required pattern:

```ts
supabase.from("repair_orders").select("*").eq("store_id", actor.storeId).eq("id", id)
```

## RLS Strategy

Current app uses service role on the backend, so RLS is not the only protection. The plan uses two layers:

1. Application-level tenant filtering in every server repository.
2. Postgres RLS policies as defense-in-depth for future browser/direct API access and accidental grants.

Example policy shape:

```sql
using (
  store_id in (
    select store_id
    from public.store_memberships
    where user_id = (select auth.uid())
      and status = 'active'
  )
)
```

Performance notes:

- Index every `store_id` and common `(store_id, status, updated_at desc)` query.
- Wrap `auth.uid()` in `(select auth.uid())` in policies.
- Keep helper functions row-independent where possible.

## Performance Plan

### API

- Move large lists to server-side pagination everywhere; avoid fetching 1000 rows and filtering in memory.
- Add query keys scoped by store: `["orders", storeId, filters]`.
- Use debounced search input for customers/orders/inventory.
- Use `keepPreviousData` style UX for pagination/filter changes.
- Avoid `count: "exact"` on high-volume lists unless the UI truly needs it; use estimated counts or page existence.

### Database

Core indexes:

- `repair_orders(store_id, status, updated_at desc)`
- `repair_orders(store_id, customer_id, updated_at desc)`
- `repair_orders(store_id, public_no)`
- `customers(store_id, phone_raw)`
- `devices(store_id, customer_id)`
- `inventory_items(store_id, status, updated_at desc)`
- `inventory_items(store_id, serial_or_imei)`
- `audit_logs(store_id, entity_type, entity_id, created_at desc)`

Search:

- First version: scoped `ilike` + indexed exact fields.
- Later: generated `search_text` + trigram index or full-text search.

### Frontend

- Add `loading.tsx` for dynamic routes such as `/orders/[id]`, `/customers/[id]`.
- Prefer desktop detail dialogs / sheets to avoid full navigation for high-frequency checks.
- Prefetch details only on hover/focus for visible rows, not entire pages.
- Add route-level skeletons and compact dense tables.
- Add Server-Timing headers around heavy API routes for profiling.

### Observability

- Log API duration, store_id, entity, action, row count.
- Add Web Vitals collection.
- Track slow queries with `pg_stat_statements`.
- Add audit-log search UI later for owner/manager.

## UI Plan

### Store Switcher

Add to `AppBar`:

- Current store name.
- Store switch dropdown for users with multiple memberships.
- "Manage stores" entry for owner/manager.

Switch behavior:

- POST `/api/repairdesk/store/switch`.
- Server validates membership and sets signed cookie.
- Client invalidates all `repairdesk` React Query keys.

### First Login

If user has no membership:

- Create personal store automatically:
  - name from email prefix or "My RepairDesk".
  - owner membership.
  - default `store_settings`.
  - default `message_templates`.
- Redirect to `/settings` to complete store profile.

### Settings

`/settings` becomes per-store:

- Store profile.
- Warranty defaults.
- Print footer.
- Message signature.
- Members and invitations in a later tab.

### Messages

`/messages` becomes per-store:

- Each store has its own editable templates.
- Defaults are seeded when store is created.
- Reset restores default for the active store only.

## Implementation Phases

### Phase 0: Stabilize Current Work

- Finish message/settings template implementation enough to typecheck.
- Ensure no client component imports server-only modules.
- Add tests for template rendering and defaults.
- Keep current single-store behavior until tenant migration lands.

### Phase 1: Tenant Schema Foundation

- Create `stores`, `store_memberships`, `store_invitations`.
- Add nullable `store_id` to all tenant tables.
- Create default store for existing data.
- Backfill every existing row to default store.
- Add indexes and store-scoped unique constraints.
- Make `store_id` not null after backfill.

### Phase 2: Tenant-Aware Auth Context

- Extend `getRequestActor()` to return active store context.
- Add `ensurePersonalStoreForUser()` for first login.
- Add store switch API and signed active-store cookie.
- Add role checks by store membership.

### Phase 3: Repository Isolation

- Update orders, customers, inventory, messages, settings repositories to require actor/store context.
- Add `.eq("store_id", actor.storeId)` to all reads/updates/deletes.
- Set `store_id` on all inserts.
- Add cross-store tests for every write path.

### Phase 4: UI Multi-Store

- Add AppBar store switcher.
- Add `/settings` store profile and member management sections.
- Add first-login store setup flow.
- Update query keys to include store id.

### Phase 5: RLS Hardening

- Add membership-based RLS policies.
- Keep service role backend, but write tests that verify policy behavior using authenticated test clients.
- Add SQL tests for cross-store denial.

### Phase 6: Performance And Enterprise Finish

- Server-side pagination for all high-volume lists.
- Search indexes / full-text search.
- Route loading skeletons.
- Server timing and slow query reports.
- Optional enterprise physical tenant isolation design.

## Acceptance Criteria

- User A and User B can sign in with different emails and get separate stores by default.
- User A cannot read, update, delete, search, import, export, notify, or audit User B's store data.
- A user invited to two stores can switch stores and sees scoped data each time.
- All create/update/delete/transition/payment/message/import operations record `store_id`, actor, timestamp, before/after where applicable.
- `/messages` and `/settings` are scoped to the active store.
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` pass.
- E2E covers:
  - first login creates store;
  - second user creates a different store;
  - cross-store direct API access returns 404/403;
  - owner invites employee;
  - employee action writes audit log in the correct store.

## References

- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Next.js SSR client: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase user data/profile tables: https://supabase.com/docs/guides/auth/managing-user-data
- Supabase RBAC/custom claims: https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac
- Next.js multi-tenant guide: https://nextjs.org/docs/app/guides/multi-tenant
- Next.js navigation performance: https://nextjs.org/docs/app/getting-started/linking-and-navigating
- Next.js caching: https://nextjs.org/docs/app/guides/caching
