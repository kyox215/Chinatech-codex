# Differing Duplicate Files Review — TASK-20260619-005

- Task: `TASK-20260619-005`
- Status: review completed; `npm run agents:check` passed; full `tools/ai_company.py validate` did not complete because the tool traversed the full repository with `Path.rglob("*.md")` before skip filtering
- Scope: the 32 Git-visible duplicate files from `TASK-20260619-004` whose content differs from their canonical non-` 2` counterpart
- Boundary: no duplicate file was deleted, staged, reverted, merged, or edited
- Baseline rule: canonical non-` 2` files remain authoritative until the Owner approves a cleanup or salvage task

## Executive Summary

The 32 differing duplicate files are not safe to bulk delete without an Owner decision package, but none should be merged directly into business code.

| Recommendation | Count | Meaning |
|---|---:|---|
| Remove after Owner confirmation | 18 | Duplicate is stale/older and canonical file already contains the current rule, UI, logic, or test coverage. |
| Remove after domain confirmation | 12 | Duplicate conflicts with current business/data semantics; record the conflict and confirm canonical behavior before deletion. |
| Backlog / salvage candidate only | 2 | Duplicate should not replace canonical code, but may contain a future check/test idea worth extracting in a separate task. |

Correction from `TASK-20260619-006`: the original summary row counts said 20/10/2, but the file-level table and Batch A/B/C lists are 18/12/2. The explicit file-level table is authoritative.

## High-Signal Findings

1. `.cursor/rules/* 2.mdc` files are stale TanStack Start/Vite/TanStack Router guidance. Canonical rules now align with Next.js App Router, RepairOS UI patterns, and AI Company OS adoption.
2. Inventory, message, mobile shared UI, and order task screen duplicates are mostly older snapshots missing current features, tests, or responsive behavior.
3. Order workflow/status duplicates contain real semantic conflicts around `mail_in_progress`, `repaired`, and `quoted -> parts_ordered`. Canonical files currently keep external repair and repaired orders in the repair workflow stage until customer notification.
4. Three duplicate migration files encode older status mapping/transition semantics. Do not merge or rewrite migration history from these duplicates.
5. `scripts/check-agent-rules 2.mjs` and `tests/e2e/visual-overflow.spec 2.ts` are the only backlog/salvage candidates. They should be reviewed as new work items, not copied over canonical files.

## File-Level Review

| # | Domain | Duplicate file | Diff size from canonical | Review conclusion | Recommendation |
|---:|---|---|---|---|---|
| 1 | Cursor rules | `.cursor/rules/00-overview 2.mdc` | +24 / -40 | Stale TanStack Start/Vite/TanStack Router overview; canonical reflects Next.js/App Router and current governance. | Remove after Owner confirmation. |
| 2 | Cursor rules | `.cursor/rules/20-layout-shell 2.mdc` | +30 / -27 | Stale `src/routes/__root.tsx`, `SidebarProvider`, and old shell guidance. | Remove after Owner confirmation. |
| 3 | Cursor rules | `.cursor/rules/30-components 2.mdc` | +30 / -25 | Stale component rules referencing old route and mock API patterns. | Remove after Owner confirmation. |
| 4 | Cursor rules | `.cursor/rules/40-page-recipes 2.mdc` | +77 / -35 | Stale page recipe guidance for `createFileRoute`/old glass UI. | Remove after Owner confirmation. |
| 5 | Cursor rules | `.cursor/rules/60-stack-conventions 2.mdc` | +20 / -28 | Stale stack convention file referencing TanStack Start/Router/Vite and old deploy assumptions. | Remove after Owner confirmation. |
| 6 | Governance | `AI智能部门管理/部门化管理设计 2.md` | +7 / -63 | File declares itself a deprecated/non-authoritative old version and omits current v3/Codex-native governance. | Remove after Owner confirmation, or archive outside source tree if Owner wants historical reference. |
| 7 | Docs | `docs/BUYBACK_PRICE_ENGINE_PLAN 2.md` | +1 / -18 | Older/shorter buyback plan missing current guided estimate, acceptance sequence, testing, battery health, and buyback record details. | Remove after Owner confirmation. |
| 8 | Scripts | `scripts/check-agent-rules 2.mjs` | +96 / -14 | Older broad standalone checker conflicts with current modular `scripts/agents/*` checker path. Some snippet assertions may be future backlog ideas. | Backlog / salvage candidate only; do not merge now. |
| 9 | Inventory | `src/features/inventory/model/inventory-workflow 2.ts` | +0 / -353 | Older model missing current list views, attention detection, and primary action guidance. | Remove after Owner confirmation. |
| 10 | Inventory tests | `src/features/inventory/model/inventory-workflow.test 2.ts` | +0 / -181 | Older test file missing current list-view and primary-action tests. | Remove after Owner confirmation. |
| 11 | Inventory server | `src/features/inventory/server/inventory.repository 2.ts` | +4 / -74 | Older repository missing transaction summaries, repair-cost persistence/redaction, and quote payload merge. | Remove after Owner confirmation. |
| 12 | Inventory mock | `src/features/inventory/testing/mock-api 2.ts` | +2 / -38 | Older mock missing deferred buyback quote update merge and repair-cost handling. | Remove after Owner confirmation. |
| 13 | Inventory mock tests | `src/features/inventory/testing/mock-api.test 2.ts` | +0 / -33 | Older test file missing deferred buyback update coverage. | Remove after Owner confirmation. |
| 14 | Messages | `src/features/messages/model/template-renderer 2.ts` | +0 / -137 | Older template renderer missing variable insertion, unknown-variable detection, and template health evaluation. | Remove after Owner confirmation. |
| 15 | Orders UI | `src/features/orders/components/order-list-items 2.tsx` | +50 / -40 | Alternative older card layout. Canonical keeps richer device/fault/quote/accessory density. | Remove after Owner confirmation after visual owner acceptance of current card behavior. |
| 16 | Orders UI | `src/features/orders/forms/customer-intake-lookup 2.tsx` | +14 / -16 | Older tighter/truncating popover layout. Canonical appears tuned for responsive width and long phone/name wrapping. | Remove after Owner confirmation after responsive owner acceptance. |
| 17 | Orders model | `src/features/orders/model/canonical-order-status 2.ts` | +3 / -3 | Semantic conflict: duplicate maps `mail_in_progress` to intake and `repaired` to pickup; canonical maps both with repair-stage intent. | Remove after domain confirmation; record canonical status semantics before cleanup. |
| 18 | Orders tests | `src/features/orders/model/canonical-order-status.test 2.ts` | +0 / -8 | Older test file lacks canonical assertions for external repair/repaired workflow stage. | Remove after domain confirmation. |
| 19 | Orders model | `src/features/orders/model/order-side-statuses 2.ts` | +4 / -4 | Older copy uses generic mail/posting label and info tone; canonical uses external-repair wording and progress tone. | Remove after domain confirmation. |
| 20 | Orders tests | `src/features/orders/model/order-side-statuses.test 2.ts` | +1 / -1 | Test expectation follows older external repair label. | Remove after domain confirmation. |
| 21 | Orders model | `src/features/orders/model/order-task-flow 2.ts` | +0 / -22 | Older task guidance missing explicit `mail_in_progress` and `repaired` task actions. | Remove after domain confirmation. |
| 22 | Orders tests | `src/features/orders/model/order-task-flow.test 2.ts` | +0 / -16 | Older test file lacks repaired-order guidance coverage. | Remove after domain confirmation. |
| 23 | Orders model | `src/features/orders/model/order-transition-reasons 2.ts` | +0 / -32 | Older file lacks required mail-in/external-repair reason presets. | Remove after domain confirmation. |
| 24 | Orders model | `src/features/orders/model/order-workflow 2.ts` | +1 / -1 | Semantic conflict: duplicate excludes `mail_in_progress` from repair bucket; canonical includes it. | Remove after domain confirmation. |
| 25 | Orders tests | `src/features/orders/model/order-workflow.test 2.ts` | +2 / -2 | Test expectation follows older `mail_in_progress` grouping. | Remove after domain confirmation. |
| 26 | Orders screen | `src/features/orders/screens/order-task-screen 2.tsx` | +109 / -485 | Older mobile-only task screen missing current desktop workspace, secondary actions, approval guard, transition reason dialog, and abnormal-branch prompts. | Remove after Owner confirmation. |
| 27 | Auth/server | `src/server/auth-context 2.ts` | +0 / -2 | Older copy lacks current E2E auth bypass integration. | Remove after Owner confirmation after QA accepts current E2E auth rule. |
| 28 | Shared UI | `src/shared/ui/repair-os-mobile 2.tsx` | +3 / -220 | Older shared UI missing current RepairOS list scaffold, floating header stepper, and header action button. | Remove after Owner confirmation. |
| 29 | Data migration | `supabase/migrations/20260611164138_order_workflow_statuses 2.sql` | +1 / -2 | Duplicate lacks canonical `quoted -> parts_ordered` transition and differs in sort order. | Remove after data/domain confirmation; do not merge into migration history. |
| 30 | Data migration | `supabase/migrations/20260611202504_repairdesk_canonical_order_status 2.sql` | +2 / -2 | Semantic conflict: duplicate maps `repaired` to pickup; canonical maps it to repair. | Remove after data/domain confirmation; do not merge into migration history. |
| 31 | Data migration | `supabase/migrations/20260613113000_repairdesk_order_contract_compat 2.sql` | +2 / -2 | Same repaired-to-pickup conflict as migration 20260611202504. | Remove after data/domain confirmation; do not merge into migration history. |
| 32 | E2E tests | `tests/e2e/visual-overflow.spec 2.ts` | +6 / -6 | Duplicate tests attachment inventory dialog stability; canonical tests records workspace stability. This may be useful as a separate E2E expansion. | Backlog / salvage candidate only; do not replace canonical test. |

## Cleanup Decision Package

### Batch A — Remove After Owner Confirmation

These look like stale shadow files with no direct salvage requirement: #1-7, #9-16, #26-28.

### Batch B — Remove After Domain/Data Confirmation

These are semantic conflicts that should be confirmed before deletion, then removed as stale duplicates if canonical behavior is accepted: #17-25, #29-31.

Decision to confirm:

- `mail_in_progress` belongs in the repair/external-repair stage, not intake.
- `repaired` remains in repair stage until customer notification/pickup handling, not pickup directly.
- `quoted -> parts_ordered` remains a valid transition.

### Batch C — Backlog / Salvage Candidate Only

Do not merge now. Convert to separate tasks only if useful:

- #8 `scripts/check-agent-rules 2.mjs`: review whether any old snippet assertions should become modular agent-rule checks.
- #32 `tests/e2e/visual-overflow.spec 2.ts`: consider adding a separate attachment-inventory overflow scenario if that UI remains active.

## Risks

| Risk | Level | Mitigation |
|---|---|---|
| Accidentally importing or executing a ` 2` duplicate | P1 | Keep canonical non-` 2` files authoritative; cleanup only after Owner approval. |
| Losing evidence of workflow semantics during cleanup | P1 | Preserve this review report and conflict record before deleting semantic-conflict duplicates. |
| Rewriting migration history from stale duplicates | P0 if attempted | Do not merge duplicate migration content; only delete duplicates after data/domain confirmation. |
| False confidence from docs-only validation | P2 | This task does not validate application behavior; future cleanup should run targeted tests after file deletion. |

## Verification Boundary

Completed:

- Compared all 32 differing duplicate/canonical pairs.
- Classified each by domain and cleanup recommendation.
- Identified semantic conflicts and backlog candidates.
- Passed `npm run agents:check`.

Not performed:

- No deletion or merge.
- No business-code edits.
- No staging, commit, push, deploy, Supabase action, or production verification.
- No full app behavior test, because this task is review-only.
- Full `tools/ai_company.py validate` was attempted and interrupted after prolonged no-output traversal; `--root .ai-company` is not a valid substitute because the validator expects the repository-level `.codex`, `.ai-company`, and `tools` structure.
