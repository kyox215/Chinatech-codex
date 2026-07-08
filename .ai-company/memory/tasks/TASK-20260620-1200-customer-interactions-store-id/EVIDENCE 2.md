# EVIDENCE

## Code Evidence

- `src/features/customers/server/customer.repository.ts`
  - Added `fetchCustomerInteractionsForCustomer` to retry customer interaction reads without `store_id` only when Supabase reports the legacy missing column.
  - Added store ownership validation before customer-message writes.
  - Added `insertCustomerInteraction` to retry legacy inserts without `store_id` only when the column is missing.
- `supabase/migrations/20260620120000_customer_interactions_store_id_repair.sql`
  - Adds `customer_interactions.store_id` if missing.
  - Backfills from `customers.store_id`.
  - Falls back remaining null rows to the default store.
  - Sets the column not null and creates the store/customer/created index.
- `src/server/tenant-guard.test.ts`
  - Adds regression checks for the customer interaction fallback and repair migration.
- `vitest.config.ts`
  - Excludes `exports/**` from root Vitest runs so generated handoff exports do not load Playwright specs as unit tests.

## Commands

- `npm run test -- src/server/tenant-guard.test.ts`: passed, 16 tests.
- `npx tsc --noEmit --pretty false`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test`: initially failed because `exports/**/tests/e2e/*.spec.ts` Playwright specs were collected by Vitest; passed after excluding `exports/**`, 39 files / 235 tests.
- `npm run build`: failed in sandbox due Turbopack local port binding permission; passed when rerun outside sandbox.

## Production Migration Evidence

- Owner approval received in chat: `批准执行生产数据库迁移`.
- Supabase project: `xluzcoduqsdvjoouqhkc`.
- Applied migration through Supabase MCP:
  - name: `customer_interactions_store_id_repair`
  - result: success.
- Production migration list now includes:
  - `20260621074627 customer_interactions_store_id_repair`.
- Production schema verification:
  - `customer_interactions.store_id` exists.
  - `store_id` data type is `uuid`.
  - `store_id` is `not null`.
- Production data verification:
  - `total_interactions = 10`.
  - `missing_store_id = 0`.
  - `distinct_stores = 1`.
- Production index verification:
  - `customer_interactions_store_customer_created_idx` exists on `(store_id, customer_id, created_at desc)`.
- Production query-path verification:
  - A `store_id + customer_id` join/query against `customer_interactions` returned `matched_interactions = 1`.
- Supabase advisors were run after the DDL:
  - Existing project-wide security/performance notices remain.
  - The newly created customer interaction index may appear as unused immediately after creation; this is expected before production traffic uses it.

## Visual Evidence

- Screenshot: `screenshots/customer-interactions-store-id-repair/customer-detail-mobile.png`
- Route: `http://127.0.0.1:3012/customers/cus_1`
- Data mode: E2E mock data using `REPAIRDESK_E2E_BUSINESS_DESKTOP=1`
- Result: mobile customer detail rendered customer content and recent activity; it did not show the `customer_interactions.store_id` load-failure card.

## Known Limits

- No production Supabase migration was executed.
- No Vercel deployment was performed.
- Screenshot uses mock data to avoid exposing real customer PII.
