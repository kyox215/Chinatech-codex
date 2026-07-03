---
task_id: TASK-20260703-007-order-queue-progress-parts-supplier
updated_at: "2026-07-03T23:36:11+02:00"
---
# Evidence

## Current Facts

- Existing `supplier_id` on repair orders is used by current code to express external repair/mail-in supplier semantics.
- Existing `suppliers` table and `RepairDeskOptions.suppliers` provide the supplier catalogue.
- The owner confirmed this task needs a separate parts-purchase supplier marker and that supplier catalogue management should stay in Settings.

## Commands And Results

- `npm run test -- src/server/api/repairdesk-schemas.test.ts src/features/orders/testing/mock-api.test.ts`: passed, 2 files / 46 tests.
- Focused ESLint on touched files: passed after formatting fixes.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run test`: passed, 42 files / 258 tests.
- `npm run build`: first sandbox attempt failed with Turbopack port binding permission; rerun with approval passed.
- Browser preview used `REPAIRDESK_E2E_BUSINESS_DESKTOP=1 npm run dev -- -p 3012` because normal local auth redirected `/orders` to `/login`.
- Browser verification state for `http://127.0.0.1:3012/orders`: title `工单 — RepairDesk`, width 1440, document scroll width 1440, 48 compact progress indicators, 48 supplier chips.
- Inline selector interaction: clicking `配件供：...` opened `选择配件供应商` menu, showed `清除配件供应商`, and URL stayed `/orders`.
- Migration diff review: composite FK delete action now clears only `parts_supplier_id`, preserving `store_id`.
- `git commit -m "Improve order queue supplier workflow"` created `ad32c53`.
- `git push origin main` pushed `01464f4..ad32c53`.
- `supabase --version`: 2.101.0.
- Linked Supabase project: `xluzcoduqsdvjoouqhkc` / `ChinaTech_date`.
- `supabase db push --linked --dry-run`: stopped before apply because remote migration versions were not found locally: `20260611103402`, `20260611103627`, `20260611171345`, `20260613101014`, `20260619194103`, `20260621074627`, `20260701214123`.
- `supabase migration list --linked`: failed after retries because `SUPABASE_DB_PASSWORD` is missing/invalid for `cli_login_postgres.xluzcoduqsdvjoouqhkc`; no production migration was applied.

## Visual Evidence

- `/Users/kyox215/Documents/文稿 - kyox215的MacBook Pro/Codex/2026-05-17/zip-github/screenshots/TASK-20260703-007-order-queue-progress-parts-supplier/orders-desktop-queue-parts-supplier.png`
- `/Users/kyox215/Documents/文稿 - kyox215的MacBook Pro/Codex/2026-05-17/zip-github/screenshots/TASK-20260703-007-order-queue-progress-parts-supplier/orders-desktop-supplier-menu.png`
- `2026-07-03T22:14:13Z` `bb035c60ea` — supabase db query verified repair_orders.parts_supplier_id exists as nullable uuid in production.
- `2026-07-03T22:14:13Z` `10a3595fac` — supabase db query verified repair_orders_parts_supplier_same_store_fkey references suppliers(id, store_id).
- `2026-07-03T22:14:13Z` `87acc904a6` — supabase db query verified repair_orders_store_parts_supplier_idx and suppliers_id_store_id_unique_idx exist.
- `2026-07-03T22:14:13Z` `35ae29393f` — supabase db query verified schema_migrations includes 20260702001000 order_device_unlock_pattern_trajectory and 20260703210959 order_parts_supplier_marker.
- `2026-07-03T22:14:13Z` `7c282f247a` — Function behavior check returned repeated_path_allowed=true and invalid_point_rejected=false.
- `2026-07-03T23:21:15Z` `60db3e5529` — Staged diff is limited to Active Context, TASK/CHECKPOINTS/EVIDENCE, and 20260703210959_order_parts_supplier_marker.sql.
- `2026-07-03T23:21:15Z` `ad6ec7f9b6` — git diff --cached --check passed before final checkpoint.
- `2026-07-03T23:21:15Z` `e50cc466d9` — Production schema/history/function checks passed for parts_supplier_id, FK, indexes, migration history, and unlock-pattern behavior.
