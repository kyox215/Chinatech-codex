# Evidence — TASK-20260707-005 Remove Duplicate Module Title Blocks

## E-001 — Source diagnosis

- `src/shared/ui/repair-os-mobile.tsx` contained `RepairOsListScaffold` default desktop rendering through `RepairOsModuleHeader`, which displayed `eyebrow`, `title`, and `subtitle` inside the page body.
- Affected list/management pages pass `title/subtitle/eyebrow` into `RepairOsListScaffold` for customers, inventory, buyback, messages, settings, platform, and dashboard.
- `src/components/app-bar.tsx` already renders desktop breadcrumbs and mobile module/store context, so the page-body module title block is duplicate context.

## E-002 — Implementation evidence

- `src/shared/ui/repair-os-mobile.tsx` now computes `desktopActions = desktopAction ?? action` and default desktop header content only renders compact actions/add-ons, not the module title block.
- `docs/UI_PAGE_GENERATION_DECLARATION.md` now forbids list/management page-body module title blocks and updates the new-page template.
- `docs/REPAIROS_COMPACT_ARCHITECTURE.md` and `docs/RESPONSIVE_DENSITY_PLAN.md` now record that page bodies must not repeat AppBar module titles, breadcrumbs, or total subtitles.

## E-003 — Validation log

- `git diff --check -- src/shared/ui/repair-os-mobile.tsx docs/UI_PAGE_GENERATION_DECLARATION.md docs/REPAIROS_COMPACT_ARCHITECTURE.md docs/RESPONSIVE_DENSITY_PLAN.md .ai-company/memory/tasks/TASK-20260707-005-remove-module-title-blocks` passed.
- Static source search still finds `eyebrow="工作台 / ..."` props in feature screens, but the shared list scaffold no longer renders them in the desktop page body.
- `npm run lint` passed after a Prettier-only formatting fix in `src/shared/ui/repair-os-mobile.tsx`.
- `npm run typecheck` passed.
- `npm run test` passed: 82 files, 531 tests.
- `npm run build` failed inside the sandbox with Turbopack `listen EPERM` / port-binding permission error, then passed outside the sandbox after owner-approved escalation.
- Desktop browser checks passed for `/`, `/customers`, `/inventory`, `/buyback`, `/messages`, `/settings`, `/platform`: each reported `h1Count: 0`, `hasWorkspaceSlash: false`, `hasSystemSlash: false`, and `hasAllTotalLine: false`.
- `/platform` rendered for the visual check but its platform requests API returned HTTP 400 in local dev; this is unrelated to the page-title removal and was not modified in this task.

## E-004 — Visual evidence

- `screenshots/TASK-20260707-005-remove-module-title-blocks/customers-desktop-top.png`
- `screenshots/TASK-20260707-005-remove-module-title-blocks/inventory-desktop-top.png`
- `screenshots/TASK-20260707-005-remove-module-title-blocks/messages-desktop-top.png`
- `screenshots/TASK-20260707-005-remove-module-title-blocks/customers-mobile-top.png`

The desktop screenshots cover the removed duplicate module-title block. The mobile screenshot shows the compact mobile floating header remains, because these routes hide the global mobile AppBar and need a mobile page status surface.
