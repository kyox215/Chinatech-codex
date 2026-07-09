---
updated_at: "2026-07-09T13:28:57Z"
status: "closed"
closed_at: "2026-07-09T13:28:57Z"
---
# TASK-20260709-016 Order Print Store Settings

Status: closed
Owner goal: 完善多店铺订单打印个性化设置计划，开始执行，完成后推送 main 并处理数据库应用。
Business value: 每个独立店铺打印订单时自动使用自己的店铺资料、联系方式和打印页脚，避免硬编码 ChinaTech 资料出现在其他店铺订单凭证上。

## Scope

- Replace hard-coded order print store identity with current `store_settings`.
- Keep order detail and order list print behavior compatible.
- Add focused tests for print profile fallback and per-store data.
- Verify whether this task requires a new database migration before any linked database action.
- Commit and push from a clean `origin/main` worktree to avoid unrelated dirty workspace changes.

## Out Of Scope

- QZ Tray or direct printer-driver integration.
- Logo/image upload storage.
- Paper-size/template builder UI beyond existing browser print.
- Applying unrelated pending Supabase migrations or repairing historical migration drift.
- Reverting or rewriting unrelated dirty worktree changes in the original checkout.

## Risk And Autonomy

- Risk: R2 for code/UI behavior and customer-facing printed PII; R3 if production database mutation or migration history repair is required.
- Autonomy: L2 for local implementation and tests. Owner instruction includes desired push/database application, but actual database write remains gated by migration preflight evidence.
- No-spawn reason: available sub-agent tool policy requires explicit user request for sub-agents/delegation; owner requested execution but did not explicitly request sub-agents.

## Acceptance Criteria

- Given store settings include a custom store name/address/contact/footer, order detail print renders those values instead of hard-coded ChinaTech defaults.
- Given order list bulk print is used, each print page uses the active store profile.
- Given store settings are missing or incomplete, print falls back to safe defaults without crashing.
- Customer-facing print does not expose unlock secrets, internal notes, or cross-store data.
- No new database migration is applied unless the migration preflight proves it is scoped to this task.
- Verification evidence records commands, results, visual evidence, and database decision.

## Implementation Plan

1. Create a shared print profile model from `StoreSettings`.
2. Wire `RepairOrderPrintSheet` and `OrderListPrintSheet` to receive/use the profile.
3. Fetch/pass store settings on order list print as order detail already does.
4. Add unit tests for profile defaults and custom per-store values.
5. Run focused tests, lint, typecheck, full tests, and build.
6. Run Supabase migration dry-run; if no task migration is needed, record database no-op/blocked state with evidence.
7. Commit and push only scoped task files from clean worktree.

## Result

- Added `src/features/print/model/store-print-profile.ts`.
- Order detail and order list print sheets now render store name, address/contact line, and footer from active `store_settings`.
- Order list screen now fetches current store settings using store-scoped React Query key before bulk print.
- No database migration was required because production `public.store_settings` already contains the needed fields.
- Broad Supabase migration application was not run because `supabase db push --linked --dry-run` is blocked by unrelated migration history drift.
