---
schema_version: 1
task_id: "TASK-20260709-018-order-load-customer-relationship"
updated_at: "2026-07-09T15:18:30Z"
---
# Evidence

## E-001 Owner Screenshot

- Source: owner attached mobile screenshot of `chinatech.in/orders`.
- Symptom: `工单加载失败`.
- Error: `Could not embed because more than one relationship was found for 'repair_orders' and 'customers'`.

## E-002 Official Behavior Reference

- PostgREST resource embedding docs state multiple foreign keys between two tables require disambiguation with `!<fk>`.
- Supabase changelog reviewed for current Data API behavior; no new table/grant issue matches this incident.

## E-003 Local Schema Evidence

- `supabase/migrations/20260611005916_harden_store_tenant_constraints.sql` adds `repair_orders_customer_same_store_fkey`.
- The same migration keeps the multi-store tenant constraint model for repair orders and customers.

## E-004 Production Schema Evidence

Command:

```bash
supabase db query --linked --output json "select conname, pg_get_constraintdef(oid) as definition from pg_constraint where conrelid = 'public.repair_orders'::regclass and confrelid = 'public.customers'::regclass order by conname;"
```

Result summary:

- `repair_orders_customer_id_fkey1`: `FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT`
- `repair_orders_customer_same_store_fkey`: `FOREIGN KEY (customer_id, store_id) REFERENCES customers(id, store_id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID`

Conclusion: production has two PostgREST-detectable `repair_orders -> customers` relationships, so `customer:customers(...)` is ambiguous.

## E-005 Code Change

- `src/server/repairdesk-shared.ts`: added `REPAIR_ORDER_CUSTOMER_EMBED = "customer:customers!repair_orders_customer_same_store_fkey"` and used it in order list/detail selects.
- `src/features/orders/server/order.repository.ts`: reused `REPAIR_ORDER_CUSTOMER_EMBED` for update and patch reads of `contact_phones`.
- `src/server/repairdesk-shared.test.ts`: added explicit relationship and source scan regression tests.

## E-006 Source Scan

Command:

```bash
rg -n "customer:customers\(" src --glob '!**/*.test.*'
```

Result: no matches.

## E-007 Verification

- `npm run test -- --run src/server/repairdesk-shared.test.ts`: passed, 1 file, 3 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed after formatting one line.
- `npm run test`: passed, 98 files, 650 tests.
- `git diff --check`: passed.
- `npm run build`: passed after rerun outside sandbox due Turbopack port-binding restriction.

## E-008 Environment Notes

- Clean worktree: `/private/tmp/repairdesk-order-load-relationship`.
- Branch: `codex/order-load-relationship-fix` tracking `origin/main`.
- Original checkout remains dirty and was not used for code edits.
- `npm ci` warning: current Node is `v20.20.2`; package requires `>=22.12.0`.
- `npm audit` reported 10 existing vulnerabilities during dependency install; not introduced by this task.
- `2026-07-09T15:21:02Z` `18db647d31` — E-001 screenshot error, E-004 production FK query, E-006 source scan, E-007 tests/lint/typecheck/build
