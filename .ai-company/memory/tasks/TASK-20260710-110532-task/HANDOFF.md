# Handoff / Resume — TASK-20260710-110532-task

## Current state

- Status: closed; implementation is complete, linked database migration has been applied/post-verified, and commit `5eda956e` has been pushed to `main`.
- Authoritative implementation docs: `docs/ORDER_DATA_ROUNDTRIP.md` and `supabase/migrations/20260710150000_order_data_roundtrip.sql`.
- Latest verified: 2026-07-10T19:15:00Z.
- Workspace: isolated worktree `/private/tmp/repairdesk-order-data-roundtrip`, branch `codex/order-data-roundtrip`, rebased onto `cee5a1b4`.
- `ACTIVE_CONTEXT.md` belongs to this task and is current.

## Owner requirements now locked in the plan

- Export complete current-store order details, not only the current order-list page.
- Download a separate blank field template.
- Organize data elsewhere and import it back without clearing existing content.
- Put all template/export/import controls in Settings; remove the old order-page export path.
- Isolate every request by authenticated account and active store.
- Only the current store's primary owner (`stores.owner_user_id`) may use template/export/import/statistics.
- Managers, technicians, frontdesk, viewers, other owner-role members, platform admins and support accounts are denied.

## Key evidence

- Settings now has a primary-owner-only `工单数据` section.
- Active order-list browser CSV export path is removed.
- Manager/technician/sales/viewer are denied order/customer export and order import actions in the role matrix; primary-owner gate adds `stores.owner_user_id === actor.id`.
- XLSX parsing rejects macros, formulas, external links, unsafe ZIP paths, encryption and oversized payloads.
- Import preview persists short-lived batches and rows; apply is a service-role RPC that revalidates active primary ownership and store scope.
- Linked dry-run listed only `20260710150000_order_data_roundtrip.sql`; migration was applied and post-verified.
- Full validation before DB apply: lint, typecheck, full Vitest 108 / 727, build, audit.

## Next action

No required next action for this task. Any live synthetic import/apply exercise should be a separate approved task because it would create or mutate production business data.

## Stop conditions

- Do not apply production imports or exports in a planning task.
- Do not call the SeaTable CLI apply/clear path.
- Do not implement clear/replace-all behavior.
- Do not trust client-provided `store_id`.
- Do not rely on `storeRole === "owner"` alone.
- Do not add dependencies, migrations, deploy, commit or push without the appropriate follow-up scope and approval.
- Do not reintroduce `pg_cron` in this task. The first release uses the cleanup RPC before import-preview creation.
- Do not apply the database if dry-run lists anything besides `20260710150000_order_data_roundtrip.sql`.

## No-spawn reason

Real read-only sub-agents were used during implementation/release review. The release reviewer raised `pg_cron` scope risk; the main thread removed automatic Cron install/job scheduling and retained cleanup RPC only. The main thread remains sole writer and release owner.
