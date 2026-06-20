# Checkpoints

## 2026-06-20T01:40:06+02:00 - Start

- Scope normalized from the owner request.
- Current plan: create Figma-first system and page targets before broad application refactor.
- Hard constraint: do not touch mobile order detail or mobile order work-order management.
- Current repository has many pre-existing modified and untracked files; this task will avoid unrelated files.

## Next

- Resume after the Figma MCP Starter call limit clears or the plan is upgraded.
- Use the three-page layout because the Starter plan caps this file at three pages:
  - `00 Overview & Foundations`
  - `01 Components`
  - `02 Page Targets & Protected`
- Create Figma component frames/components for RepairDesk UI.
- Create non-protected desktop page targets.
- Verify Figma structure and capture visual evidence.

## 2026-06-20T01:40:06+02:00 - Partial Foundation Write

- Figma file was created.
- Variables were created before the first write call hit a TextStyle fill limitation.
- Text styles, paint styles, and effect styles were created on retry.
- Page/component generation is blocked by the Figma MCP Starter call limit.
- No protected mobile order source files were edited in this task.
- Local task-memory verification passed: JSON parse succeeded and `npm run agents:check` passed.

## 2026-06-20T01:40:06+02:00 - Resume Attempt and Local Progress

- Figma metadata call is still blocked by the Figma MCP Starter tool-call limit.
- Added project-level UI system documentation at `docs/REPAIRDESK_FIGMA_UI_SYSTEM.md`.
- Added Figma MCP resume runbook at `FIGMA_MCP_RESUME_RUNBOOK.md`.
- Added missing `pageHeader` shared declaration to `src/lib/ui-patterns.ts`, aligning code with `docs/UI_PAGE_GENERATION_DECLARATION.md`.
- Verification passed: `npm run lint`, `npm run typecheck`, `npm run agents:check`, `npx vitest run --exclude "exports/**"`, and non-sandbox `npm run build`.
- Plain `npm run test` fails because the current worktree has an exported source copy under `exports/` and Vitest loads Playwright e2e files from that copy.
- Sandboxed `npm run build` fails with a Turbopack process/port-binding permission error; the non-sandbox retry passes.
- Protected mobile order detail and mobile order work-order management were not edited by this task.

## 2026-06-20T01:40:06+02:00 - Third Figma Limit and Shared Header Refactor

- Figma metadata remains blocked by the same Figma MCP Starter tool-call limit.
- The goal is not marked blocked because code-side non-protected page refactor work remained meaningful and was completed.
- `RepairOsModuleHeader` now supports shared compact desktop titles through `pageHeader`.
- Customers, inventory, buyback, messages, settings, and platform admin desktop headers now use the unified title/subtitle/eyebrow pattern.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/customers-desktop.png`
  - `screenshots/figma-ui-system-20260620/inventory-mobile.png`
  - `screenshots/figma-ui-system-20260620/settings-desktop.png`
- Screenshot DOM checks confirmed no login redirect and horizontal overflow `0` for `/customers`, `/inventory`, and `/settings`.
- Verification passed: `npm run lint`, `npm run typecheck`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, and `npm run agents:check`.

## 2026-06-20T01:40:06+02:00 - Dashboard Header Batch

- Figma metadata remains blocked by the same Figma MCP Starter tool-call limit.
- Dashboard desktop now uses the shared compact `RepairOsModuleHeader` title/subtitle/eyebrow pattern.
- Dashboard mobile layout remains unchanged by the desktop header prop and was screenshot-verified.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/dashboard-desktop.png`
  - `screenshots/figma-ui-system-20260620/dashboard-mobile.png`
- Screenshot DOM checks confirmed no login redirect and horizontal overflow `0` for `/` at desktop and mobile viewport sizes.
- Verification passed: `npm run lint`, `npm run typecheck`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, and `npm run agents:check`.

## 2026-06-20T02:23:06+02:00 - Customer Detail Hero Batch

- Figma metadata remains blocked by the same Figma MCP Starter tool-call limit.
- `src/features/customers/components/customer-hero.tsx` now uses the shared `pageHeader` title/subtitle/eyebrow/action layout for customer detail desktop/dialog hero.
- The mobile customer detail floating header remained unchanged and was screenshot-verified.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/customer-detail-desktop.png`
  - `screenshots/figma-ui-system-20260620/customer-detail-mobile.png`
- Screenshot DOM checks confirmed no login redirect and horizontal overflow `0` for `/customers/cus_1` at desktop and mobile viewport sizes.
- Verification passed: `npm run lint`, `npm run typecheck`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, and `npm run agents:check`.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T02:31:32+02:00 - List Scaffold Default Header Batch

- Figma library/read call remains blocked by the same Figma MCP Starter tool-call limit.
- `RepairOsListScaffold` now supports default desktop header rendering via `eyebrow`, `title`, `subtitle`, and `desktopAction`.
- Non-protected list pages now pass `eyebrow` into the shared scaffold so fallback/loading/error states can share the same desktop header semantics.
- `MessagesScreen` no longer hand-writes a desktop module header; it uses the scaffold default header with a desktop-only full save button while mobile keeps the compact icon action.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/messages-desktop.png`
  - `screenshots/figma-ui-system-20260620/messages-mobile.png`
- Screenshot DOM checks confirmed no login redirect and horizontal overflow `0` for `/messages` at desktop and mobile viewport sizes.
- Verification passed: `npm run lint`, `npm run typecheck`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and `git diff --check`.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T02:39:57+02:00 - List Scaffold Header Addon Batch

- Figma library/read call remains blocked by the same Figma MCP Starter tool-call limit.
- `RepairOsListScaffold` now supports `desktopHeaderAddon` for KPI grids and metric strips below the unified default desktop header.
- Dashboard, customers, inventory, buyback, settings, and platform admin now use Scaffold `desktopAction` / `desktopHeaderAddon` instead of hand-writing their own desktop title blocks.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/scaffold-dashboard-desktop.png`
  - `screenshots/figma-ui-system-20260620/scaffold-customers-desktop.png`
  - `screenshots/figma-ui-system-20260620/scaffold-inventory-desktop.png`
  - `screenshots/figma-ui-system-20260620/scaffold-buyback-desktop.png`
  - `screenshots/figma-ui-system-20260620/scaffold-settings-desktop.png`
  - `screenshots/figma-ui-system-20260620/scaffold-platform-desktop.png`
  - `screenshots/figma-ui-system-20260620/scaffold-inventory-mobile.png`
- Screenshot DOM checks confirmed no login redirect and horizontal overflow `0` for `/`, `/customers`, `/inventory`, `/buyback`, `/settings`, `/platform`, and mobile `/inventory`.
- Verification passed: `npm run lint`, `npm run typecheck`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and `git diff --check`.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T02:49:38+02:00 - Shared Section Header Batch

- Added and exported `RepairOsSectionHeader` from the shared RepairOS UI layer.
- The shared section header supports dense panel titles, optional descriptions, optional icons, optional right-side action/badge content, framed or unframed icon rendering, and h2/h3/h4 heading levels.
- Dashboard, Settings, Messages, Platform admin, and Buyback record detail section-title markup now uses the shared component instead of local one-off header markup.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/section-header-dashboard.png`
  - `screenshots/figma-ui-system-20260620/section-header-messages.png`
  - `screenshots/figma-ui-system-20260620/section-header-settings.png`
  - `screenshots/figma-ui-system-20260620/section-header-platform.png`
  - `screenshots/figma-ui-system-20260620/section-header-buyback.png`
  - `screenshots/figma-ui-system-20260620/section-header-messages-mobile.png`
  - `screenshots/figma-ui-system-20260620/section-header-settings-mobile.png`
  - `screenshots/figma-ui-system-20260620/section-header-buyback-detail-mobile.png`
- Screenshot DOM checks confirmed horizontal overflow `0` for all captured routes and the Buyback detail drawer.
- Verification passed: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and `git diff --check`.
- Protected order files remain dirty from the existing worktree state, but this section-header batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T02:58:21+02:00 - Customer and Inventory Detail Section Header Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Customer detail panels now use `RepairOsSectionHeader` for overview, recent activity, device archive, order history, messages, profile, followups, and timeline section titles.
- Inventory detail dialog/drawer now uses `RepairOsSectionHeader` for buyback source, product, checks, attachments, finance transactions, and timeline section titles.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/shared-section-customer-detail-desktop.png`
  - `screenshots/figma-ui-system-20260620/shared-section-customer-detail-mobile.png`
  - `screenshots/figma-ui-system-20260620/shared-section-inventory-detail-desktop.png`
  - `screenshots/figma-ui-system-20260620/shared-section-inventory-detail-mobile.png`
- Screenshot DOM checks confirmed no login redirect and horizontal overflow `0` for `/customers/cus_1` desktop/mobile and inventory detail desktop/mobile.
- Verification passed: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and `git diff --check`.
- Protected order files remain dirty from the existing worktree state, but this batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T03:09:57+02:00 - Shared Info Tile/Grid Batch

- Figma metadata/page work remains blocked by the Figma MCP Starter tool-call limit, so this batch continued local non-protected component convergence.
- Added and exported `RepairOsInfoTile` and `RepairOsInfoGrid` from the shared RepairOS UI layer.
- The shared info primitives cover the Figma Info Card, Metric Card, and Data Row targets for dense entity details.
- Customer detail metrics and profile/info blocks now use `RepairOsInfoTile`.
- Inventory detail finance tiles now use `RepairOsInfoTile`; product/check sections now use `RepairOsInfoGrid`.
- Inventory detail dialog now forces the dense flex shell with `!flex` and `!p-0`, fixing the default Dialog grid/padding expansion seen in the first screenshot pass.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/info-tile-customer-detail-desktop.png`
  - `screenshots/figma-ui-system-20260620/info-tile-customer-detail-mobile.png`
  - `screenshots/figma-ui-system-20260620/info-tile-inventory-detail-desktop.png`
  - `screenshots/figma-ui-system-20260620/info-tile-inventory-detail-mobile.png`
- Screenshot DOM checks confirmed no login redirect and horizontal overflow `0` for `/customers/cus_1` desktop/mobile and inventory detail desktop/mobile.
- Verification passed: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and `git diff --check`.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T03:17:54+02:00 - Buyback Quote Shared Primitive Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Added and exported `RepairOsInfoLine` from the shared RepairOS UI layer for single-row dense label/value data rows.
- Buyback quote workspace local `SectionTitle`, `InfoMetric`, `MetricPill`, and `InfoLine` now delegate to shared RepairOS primitives.
- This batch did not change buyback quote calculation, persistence, attachment upload, or inventory transition logic.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/buyback-quote-workspace-desktop.png`
  - `screenshots/figma-ui-system-20260620/buyback-quote-workspace-mobile.png`
- Screenshot DOM checks confirmed no login redirect and horizontal overflow `0` for `/buyback?new=1` desktop and mobile.
- Verification passed: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and `git diff --check`.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this buyback quote primitive batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T03:23:11+02:00 - Customer Detail Metric Tile Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Customer detail mobile floating-header metrics now delegate to `RepairOsInfoTile`.
- Customer detail desktop summary-rail metrics now delegate to `RepairOsInfoTile`.
- This batch did not change customer data loading, mutations, tags, messages, devices, followups, or timeline logic.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/customer-detail-metric-tiles-desktop.png`
  - `screenshots/figma-ui-system-20260620/customer-detail-metric-tiles-mobile.png`
- Screenshot DOM checks confirmed no login redirect and horizontal overflow `0` for `/customers/cus_1` desktop and mobile.
- Verification passed: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and `git diff --check`.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this customer metric tile batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T03:30:37+02:00 - Buyback Record Metric Tile Batch

- Buyback record detail `RecordMetric` now delegates to `RepairOsInfoTile`.
- The shared tile migration covers the record sheet's quote basis, device/material, and inspection/proof metric groups.
- This batch did not change buyback record data loading, quote calculations, inventory handoff, readiness/task guidance, or persistence behavior.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/buyback-record-metrics-desktop.png`
  - `screenshots/figma-ui-system-20260620/buyback-record-metrics-mobile.png`
- Screenshot DOM checks confirmed no login redirect and horizontal overflow `0` for `/buyback` record detail desktop and mobile.
- Verification passed: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and `git diff --check`.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this buyback record metric batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T03:40:39+02:00 - Dashboard and Platform Info Tile Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Dashboard KPI metric cards now delegate label/value rendering to `RepairOsInfoTile`.
- Platform approval dialog applicant, email, type, target, requested role, and submitted-time fields now delegate to `RepairOsInfoTile`.
- This batch did not change dashboard data fetching, platform approval/reject mutations, onboarding API calls, or store permissions.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/dashboard-info-tile-metrics-desktop.png`
  - `screenshots/figma-ui-system-20260620/dashboard-info-tile-metrics-mobile.png`
  - `screenshots/figma-ui-system-20260620/platform-info-tile-mobile.png`
  - `screenshots/figma-ui-system-20260620/platform-approval-info-tile-dialog-mocked-desktop.png`
- Platform dialog screenshot used a browser-only Playwright route mock for one pending request because the current seed state has zero pending platform requests; no data was written.
- Screenshot DOM checks confirmed horizontal overflow `0` for `/` desktop/mobile, `/platform` desktop/mobile, and the route-mocked Platform approval dialog.
- Verification passed: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and `git diff --check`.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this Dashboard/Platform info tile batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T03:49:37+02:00 - Buyback Inline Info Tile Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- `RepairOsInfoTile` now supports optional `leading`, `meta`, `bodyClassName`, and `metaClassName` slots for dense icon-plus-data tile variants.
- Buyback mobile inline customer/device/quote information blocks now delegate to `RepairOsInfoTile`.
- This batch did not change buyback record queries, quote calculations, status labels, inventory handoff, or persistence behavior.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/buyback-info-tile-desktop.png`
  - `screenshots/figma-ui-system-20260620/buyback-info-tile-mobile.png`
- Playwright DOM checks confirmed `/buyback` desktop/mobile rendered both sample records and had horizontal overflow `0`.
- Verification passed: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and `git diff --check`.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this buyback inline info tile batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T03:57:10+02:00 - Dashboard Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- `RepairOsBusinessCard` now supports optional `leading`, `bodyClassName`, `trailing`, and slot class overrides for dense business card/action-row variants.
- Dashboard task cards, quick module links, recent order cards, and recent-order skeletons now delegate to `RepairOsBusinessCard`.
- This batch did not change dashboard data loading, order stats, dashboard insight logic, order links, or order data formatting.
- `docs/COMPONENT_GENERATION_DECLARATION.md` now directs future standard business cards and quick entries to use the `RepairOsBusinessCard` leading/body/trailing slots instead of hand-written icon/text/trailing grids.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/dashboard-business-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/dashboard-business-card-mobile.png`
- Playwright DOM checks confirmed `/` desktop/mobile rendered the Dashboard title, quick modules, and recent-order or task sections, with horizontal overflow `0`.
- Verification passed: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and `git diff --check`.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this Dashboard Business Card batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T04:09:35+02:00 - Customer Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Customer detail device cards, order rows, contact records, and followup rows now delegate to `RepairOsBusinessCard`.
- This batch did not change customer data loading, order links, device actions, message actions, followup completion, status badges, or money formatting.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/customer-business-card-device-desktop.png`
  - `screenshots/figma-ui-system-20260620/customer-business-card-orders-mobile.png`
  - `screenshots/figma-ui-system-20260620/customer-business-card-contact-mobile.png`
- Playwright DOM checks confirmed customer detail device/order/contact tabs rendered expected content on desktop/mobile and had horizontal overflow `0`.

- Verification passed: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, and `git diff --check`.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this customer business card batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T04:17:27+02:00 - Settings Shared Cards Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Settings section titles now call `RepairOsSectionHeader` directly; the local `SectionTitle` wrapper was removed.
- Settings readiness checklist rows, store member rows, and invitation rows now delegate to `RepairOsBusinessCard`.
- This batch did not change store settings queries, store switching, member invite, order workflow status editing, or save mutations.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/settings-shared-cards-desktop.png`
  - `screenshots/figma-ui-system-20260620/settings-shared-cards-members-mobile.png`
- Playwright DOM checks confirmed `/settings` rendered settings, store management, members, and readiness sections on desktop/mobile with horizontal overflow `0`.
- Verification passed: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, and `git diff --check`.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this settings shared cards batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T04:23:14+02:00 - Dashboard Direct Section Header Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Dashboard Today Tasks, Quick Modules, and Recent Orders section titles now call `RepairOsSectionHeader` directly.
- The local Dashboard `SectionTitle` wrapper was removed.
- This batch did not change dashboard data loading, order stats, task calculations, quick-module links, recent-order links, or order formatting.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/dashboard-section-header-direct-desktop.png`
  - `screenshots/figma-ui-system-20260620/dashboard-section-header-direct-mobile.png`
- Playwright DOM checks confirmed `/` rendered overview, Today Tasks, Quick Modules, and Recent Orders on desktop/mobile with horizontal overflow `0`.
- Verification passed: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, and `git diff --check`.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this Dashboard direct section header batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T04:32:17+02:00 - Platform Request Card Batch

- Figma metadata/page work remains blocked by the same Figma MCP Starter tool-call limit, so this batch continued local non-protected component convergence.
- Platform admin mobile `RequestCard` now delegates to `RepairOsBusinessCard`.
- This batch did not change platform approval/reject mutations, the desktop table row, the decision dialog, onboarding API calls, or permissions.
- Visual evidence used browser-only Playwright route mocks for two pending requests because seed data may have zero pending platform requests; no backend data was written.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/platform-request-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/platform-request-card-mobile.png`
- Playwright DOM checks confirmed `/platform` desktop/mobile had horizontal overflow `0` and two visible approval action buttons in each viewport.
- Verification passed: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, and `git diff --check`.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Dev server was stopped and port `3012` was released.
- Final Figma read-only resume check at `2026-06-20T04:34:20+02:00` still returned the Figma MCP Starter tool-call limit; no Figma write was attempted after that blocker.
- Protected order files remain dirty from the existing worktree state, but this platform request card batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T04:41:01+02:00 - Inventory Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Inventory mobile `InventoryMobileCard` now delegates to `RepairOsBusinessCard`.
- This batch did not change inventory queries, filters, status actions, amount calculations, desktop table behavior, detail dialog behavior, or server/API code.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/inventory-business-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/inventory-business-card-mobile.png`
- Playwright DOM checks confirmed `/inventory` desktop/mobile had horizontal overflow `0`; desktop table stayed visible and mobile rendered 3 inventory article cards.
- Verification passed: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, and `git diff --check`.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this inventory business card batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T04:53:46+02:00 - Customer Tags Business Card Batch

- Figma metadata/page work remains blocked by the same Figma MCP Starter tool-call limit, so this batch continued local non-protected component convergence.
- `RepairOsBusinessCard` now supports `as="article" | "div" | "label"` for semantic card shells.
- `RepairOsBusinessCard` now applies slot grid classes after dense card classes, so leading/body/trailing slot layouts override default dense grid columns.
- Customer tag selection rows now use `RepairOsBusinessCard as="label"` with a native controlled checkbox, preserving whole-row click behavior without nesting a Radix button inside a label.
- `docs/COMPONENT_GENERATION_DECLARATION.md` now documents that label-style compact selection rows must use native input or label-compatible controls.
- This batch did not change customer data loading, tag save mutations, tag defaults, dialog open/close behavior, or any order screens.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/customer-tags-business-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/customer-tags-business-card-mobile.png`
- Playwright DOM checks confirmed `/customers/cus_1` opened the tag dialog from the profile tab on desktop/mobile, rendered 5 tag rows, toggled `复购` by clicking row text, and had horizontal overflow `0`.
- Verification passed: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, and `git diff --check`.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this customer tags business card batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T05:03:10+02:00 - Customer List InfoTile Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- `RepairOsInfoTile` now supports optional `trailing`, `leadingClassName`, and `trailingClassName` props.
- `RepairOsInfoTile` switches to flex slot layout only when leading/trailing content exists, preserving existing plain label/value usages.
- Customer list KPI cards now delegate label/value/icon rendering to `RepairOsInfoTile`.
- Customer mobile card next-step blocks now delegate label/value rendering to `RepairOsInfoTile`.
- This batch did not change customer list query keys, filters, pagination, desktop table rows, mobile card links, detail preview dialog, customer creation flow, or any order screens.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/customer-list-info-tile-kpi-desktop.png`
  - `screenshots/figma-ui-system-20260620/customer-list-info-tile-mobile.png`
- Playwright DOM checks confirmed `/customers` desktop rendered the KPI and 20 table rows, mobile rendered 20 customer cards and 20 next-step blocks, and both viewports had horizontal overflow `0`.
- Verification passed: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, and `git diff --check`.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this customer list InfoTile batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T05:12:23+02:00 - Messages Business Card Action Row Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- `RepairOsBusinessCard` now supports `as="button"` with native button `type` / `disabled` props while keeping existing article/div/label semantics.
- Message template selection rows now delegate to `RepairOsBusinessCard as="button"`.
- Variable insertion rows now delegate to `RepairOsBusinessCard as="button"`.
- This batch did not change message template save/reset/preview logic, template selection logic, variable insertion behavior, API calls, or any order screens.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/messages-business-card-actions-desktop.png`
  - `screenshots/figma-ui-system-20260620/messages-business-card-actions-mobile.png`
- Playwright DOM checks confirmed `/messages` rendered the variable helper and preview on desktop/mobile, showed 21 variable insertion buttons, inserted a `{{...}}` token into `#template-body`, and had horizontal overflow `0`.
- Verification passed: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, and `git diff --check`.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this messages action-row batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T05:21:34+02:00 - Buyback Business Card Choice/Toggle Row Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Buyback quote workspace selected-estimate summary rows now delegate to `RepairOsBusinessCard`.
- Buyback quote workspace boolean condition/inspection toggle rows now delegate to `RepairOsBusinessCard as="button"` and expose `aria-pressed`.
- This batch did not change buyback quote calculation, save/defer/reject logic, attachment handling, inventory handoff, API calls, or any order screens.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/buyback-business-card-choice-rows-desktop.png`
  - `screenshots/figma-ui-system-20260620/buyback-business-card-choice-rows-mobile.png`
- Playwright DOM checks confirmed `/buyback?new=1` rendered the quote workspace on desktop/mobile, selected model/storage/battery, showed 19 `aria-pressed` toggle/action rows and 4 selected-summary labels, and had horizontal overflow `0`.
- Verification passed: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, and `git diff --check`.
- Sandboxed `npm run dev` failed with the known `listen EPERM` port denial; non-sandbox dev server was used for screenshot verification.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this Buyback choice/toggle row batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T05:31:40+02:00 - Buyback Model Choice Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Buyback quote workspace iPhone model selection cards now delegate to `RepairOsBusinessCard as="button"`.
- The card keeps `aria-pressed`, dense shared business-card styling, and a stable trailing selected-check slot.
- This batch did not change buyback model selection side effects, storage reset, market-price reset, quote calculation, save/defer/reject logic, attachment handling, inventory handoff, API calls, or any order screens.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/buyback-model-choice-business-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/buyback-model-choice-business-card-mobile.png`
- Playwright DOM checks confirmed `/buyback?new=1` rendered the quote workspace on desktop/mobile, showed 21 `aria-pressed` action/selection rows, showed 6 visible iPhone model labels, and had horizontal overflow `0`.
- Verification passed: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and `git diff --check`.
- Sandboxed `npm run dev` failed with the known `listen EPERM` port denial; non-sandbox dev server was used for screenshot verification.
- Sandboxed Playwright Chromium failed with the known macOS `bootstrap_check_in ... Permission denied (1100)` denial; non-sandbox Playwright was used for screenshot verification.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this Buyback model-choice card batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T05:40:09+02:00 - Buyback Storage/Battery Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Buyback quote workspace storage-capacity picker now uses a scoped `StorageChoicePicker` built on `RepairOsBusinessCard as="button"`.
- Buyback quote workspace battery-health picker cards now delegate to `RepairOsBusinessCard as="button"` and expose `aria-pressed`.
- This batch did not change storage market suggestion, battery deduction, quote calculation, save/defer/reject logic, attachment handling, inventory handoff, API calls, or any order screens.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/buyback-storage-business-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/buyback-storage-business-card-mobile.png`
  - `screenshots/figma-ui-system-20260620/buyback-battery-business-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/buyback-battery-business-card-mobile.png`
- Playwright DOM checks confirmed `/buyback?new=1` rendered the quote workspace on desktop/mobile, showed 3 storage selection rows with overflow `0`, then showed 12 battery selection rows with overflow `0`.
- Verification passed: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and `git diff --check`.
- Sandboxed `npm run dev` failed with the known `listen EPERM` port denial; non-sandbox dev server was used for screenshot verification.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this Buyback storage/battery picker batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T05:50:05+02:00 - Buyback Series Picker Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Buyback quote workspace iPhone series picker cards now delegate to `RepairOsBusinessCard as="button"`.
- This batch did not change selected-series filtering, model list display, quote calculation, save/defer/reject behavior, attachments, or inventory handoff logic.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/buyback-series-business-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/buyback-series-business-card-mobile.png`
- Playwright DOM checks confirmed `/buyback?new=1` desktop/mobile rendered 13 series cards and had horizontal overflow `0`.
- Verification passed: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and `git diff --check`.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Sandboxed Playwright failed with the known macOS Chromium bootstrap permission denial; the non-sandbox screenshot pass succeeded.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this Buyback series-picker batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T06:01:26+02:00 - Buyback ChoiceGroup Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Generic Buyback quote workspace `ChoiceGroup` option chips now delegate to `RepairOsBusinessCard as="button"`.
- This batch covers screen/body condition, document type, and signature status option groups without changing quote calculation, save/defer/reject behavior, attachments, or inventory handoff logic.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/buyback-choicegroup-business-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/buyback-choicegroup-business-card-mobile.png`
- Playwright DOM checks confirmed `/buyback?new=1` desktop/mobile rendered 9 oral quote condition option chips and had horizontal overflow `0`.
- Verification passed: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, and `git diff --check`.
- Sandboxed `npm run dev` failed with the known `listen EPERM` port denial; non-sandbox dev server was used for screenshot verification.
- Sandboxed Playwright failed with the known macOS Chromium bootstrap permission denial; the non-sandbox screenshot pass succeeded.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this Buyback ChoiceGroup batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T06:08:05+02:00 - Customer List Badge Internals Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Customer list mobile device-count, work-state, payment-state, and tag chips now delegate to `RepairOsBadge`.
- `docs/COMPONENT_GENERATION_DECLARATION.md` now documents `RepairOsBadge` as the preferred primitive for repeated status/tag/count/risk chips.
- `docs/REPAIRDESK_FIGMA_UI_SYSTEM.md` now records customer list badge/internal chip convergence.
- This batch did not change customer list queries, filters, pagination, desktop row actions, mobile detail links, preview dialog, create flow, API calls, or any order screens.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/customer-list-badge-internals-desktop.png`
  - `screenshots/figma-ui-system-20260620/customer-list-badge-internals-mobile.png`
- Playwright DOM checks confirmed `/customers` desktop rendered 20 table rows, mobile rendered 20 customer cards, 20 next-step blocks, 20 visible badge text matches, and both viewports had horizontal overflow `0`.
- Verification passed: `git diff --check`, `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, browser screenshot checks, `npm run agents:check`, and final `git diff --check` for touched files.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Sandboxed `npm run dev` failed with the known `listen EPERM` port denial; non-sandbox dev server was used for screenshot verification.
- Sandboxed Playwright failed with the known macOS Chromium bootstrap permission denial; the non-sandbox screenshot pass succeeded.
- Dev server was stopped and port `3012` was released.
- Protected order files remain dirty from the existing worktree state, but this customer list badge internals batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T06:30:55+02:00 - Buyback Attachment Capture Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Buyback quote workspace attachment capture cards now delegate to `RepairOsBusinessCard as="label"`.
- Native file inputs remain nested inside the label cards; the reselect/reset button remains outside the label to avoid nested interactive controls.
- This batch did not change attachment state, camera/PDF accept/capture attributes, quote save/defer/reject behavior, inventory handoff logic, API calls, or any order screens.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/buyback-attachment-business-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/buyback-attachment-business-card-mobile.png`
- Playwright DOM checks confirmed the final Buyback capture section rendered 6 file inputs, showed the selected fake file name and one reset action, contained no `Mario Rossi` text, and had horizontal overflow `0` on desktop and mobile.
- Verification passed earlier for this code batch: `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, browser screenshot checks, and `git diff --check`.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Sandboxed `npm run dev` failed with the known `listen EPERM` port denial; non-sandbox dev server was used for screenshot verification.
- Sandboxed Playwright failed with the known macOS Chromium bootstrap permission denial; the non-sandbox screenshot pass succeeded.
- Protected order files remain dirty from the existing worktree state, but this Buyback attachment capture batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T06:42:48+02:00 - Inventory Import Preview Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Inventory SeaTable import preview now delegates to `RepairOsBusinessCard` plus `RepairOsInfoTile` summary metrics.
- Import preview warning UI shows row number, field, and reason only; it does not render raw sensitive CSV values.
- This batch did not change CSV parsing, preview mutation, apply mutation, import mapping, inventory queries, API calls, or any order screens.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/inventory-import-preview-business-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/inventory-import-preview-business-card-mobile.png`
- Playwright DOM checks confirmed `/inventory` import preview rendered the summary title, warning card, no test phone text, and horizontal overflow `0` on desktop and mobile.
- Verification passed: `git diff --check`, `npm run typecheck`, `npm run lint`, targeted inventory Vitest files, root-project Vitest excluding `exports/**`, non-sandbox `npm run build`, browser screenshot checks, and `npm run agents:check`.
- Sandboxed `npm run dev` failed with the known `listen EPERM` port denial; non-sandbox dev server was used for screenshot verification.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Dev server was stopped and port `3013` was released.
- Protected order files remain dirty from the existing worktree state, but this Inventory import preview batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T06:56:18+02:00 - Settings Workflow Transition Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Settings workflow transition target rows now delegate to `RepairOsBusinessCard as="div"` using checkbox leading, status label body, and primary-target button trailing slots.
- Added `data-ui="settings-workflow-transitions"` to the workflow transition panel for focused screenshot and DOM verification.
- This batch did not change workflow status creation, status-field editing, source status selection, transition mutation payloads, primary-target behavior, API calls, or any order screens.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/settings-workflow-transition-panel-desktop.png`
  - `screenshots/figma-ui-system-20260620/settings-workflow-transition-panel-mobile.png`
- Playwright DOM checks confirmed `/settings` rendered 14 primary-target actions and 4 checked transition rows on desktop/mobile, with document overflow `0` and panel overflow `0`.
- Verification passed: `git diff --check`, `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, browser screenshot checks, and `npm run agents:check`.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Sandboxed `npm run dev` failed with the known `listen EPERM` port denial; non-sandbox dev server was used for screenshot verification.
- Sandboxed Playwright failed with the known macOS Chromium bootstrap permission denial; the non-sandbox screenshot pass succeeded.
- Protected order files remain dirty from the existing worktree state, but this Settings workflow transition batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T07:06:36+02:00 - Messages Template Health Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Messages template enable toggle now delegates to `RepairOsBusinessCard as="div"` with a `Label htmlFor` and switch trailing slot.
- Messages template health success/issues now delegate to `RepairOsBusinessCard as="div"` with status-token icon leading slots.
- Added `data-ui="messages-template-enabled-toggle"` and `data-ui="messages-template-health"` for focused screenshot and DOM verification.
- Removed two temporary broad workspace screenshots that included preview sample customer text; retained only focused non-PII component screenshots.
- This batch did not change template save/reset mutations, template preview rendering, variable insertion, search/filter behavior, API calls, or any order screens.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/messages-template-enable-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/messages-template-enable-card-mobile.png`
  - `screenshots/figma-ui-system-20260620/messages-template-health-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/messages-template-health-card-mobile.png`
- Playwright DOM checks confirmed `/messages` rendered one switch-backed enable card and the template health card on desktop/mobile, with document overflow `0` and component overflow `0`.
- Verification passed: `git diff --check`, `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, browser screenshot checks, and `npm run agents:check`.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Sandboxed `npm run dev` failed with the known `listen EPERM` port denial; non-sandbox dev server was used for screenshot verification.
- Sandboxed Playwright failed with the known macOS Chromium bootstrap permission denial; the non-sandbox screenshot pass succeeded.
- Protected order files remain dirty from the existing worktree state, but this Messages template health batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T07:18:49+02:00 - Customer List State Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Implemented `RepairOsBusinessCard as="div"` convergence for customer list refresh warning, empty state, load error, and pagination controls in `src/features/customers/screens/customer-list-screen.tsx`.
- Updated `docs/REPAIRDESK_FIGMA_UI_SYSTEM.md` and `docs/COMPONENT_GENERATION_DECLARATION.md` with list-state/pagination Business Card guidance.
- Focused screenshots captured:
  - `screenshots/figma-ui-system-20260620/customer-list-pagination-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/customer-list-pagination-card-mobile.png`
  - `screenshots/figma-ui-system-20260620/customer-list-empty-state-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/customer-list-empty-state-card-mobile.png`
- Verification passed: scoped `git diff --check`, `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and focused browser screenshot checks.
- Full `npm run test` was attempted and still fails because Vitest collects Playwright specs inside `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST/source/tests/e2e`; the root project test pass is the excluded command above.
- Known environment denials repeated: sandboxed build Turbopack port binding, sandboxed dev `listen EPERM`, and sandboxed Chromium `bootstrap_check_in` permission denial.
- No protected mobile order detail, mobile order information, or mobile work-order management files were edited in this batch.

## 2026-06-20T07:28:48+02:00 - Inventory KPI InfoTile Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Implemented `RepairOsInfoTile` convergence for inventory header KPI cards in `src/features/inventory/screens/inventory-screen.tsx`.
- Updated `docs/REPAIRDESK_FIGMA_UI_SYSTEM.md` with inventory KPI Metric Card / Info Card guidance.
- Focused screenshots captured:
  - `screenshots/figma-ui-system-20260620/inventory-kpi-info-tile-desktop.png`
  - `screenshots/figma-ui-system-20260620/inventory-kpi-mobile-route.png`
- Verification passed: scoped `git diff --check`, `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and focused browser screenshot checks.
- Full `npm run test` was attempted and still fails because Vitest collects Playwright specs inside `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST/source/tests/e2e`; non-export root tests reported 77 files and 461 tests passed before the suite failure.
- Known environment denials repeated: sandboxed build Turbopack port binding, sandboxed dev `listen EPERM`, and sandboxed Chromium `bootstrap_check_in` permission denial.
- The mobile screenshot was cropped to the non-sensitive header/search/chips area; no protected mobile order detail, mobile order information, or mobile work-order management files were edited in this batch.

## 2026-06-20T07:40:07+02:00 - Inventory Error Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Implemented `RepairOsBusinessCard as="div"` convergence for inventory load and inline refresh errors in `src/features/inventory/screens/inventory-screen.tsx`.
- Updated `docs/REPAIRDESK_FIGMA_UI_SYSTEM.md` with inventory Status Notice / Business Card guidance.
- Focused screenshots captured:
  - `screenshots/figma-ui-system-20260620/inventory-load-error-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/inventory-load-error-card-mobile.png`
- Verification passed: scoped `git diff --check`, `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and focused browser screenshot checks.
- Full `npm run test` was attempted and still fails because Vitest collects Playwright specs inside `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST/source/tests/e2e`; non-export root tests reported 77 files and 461 tests passed before the suite failure.
- Known environment denials repeated: sandboxed build Turbopack port binding, sandboxed dev `listen EPERM`, and sandboxed Chromium `bootstrap_check_in` permission denial.
- Dev server was stopped and port `3018` was released.
- No protected mobile order detail, mobile order information, or mobile work-order management files were edited in this batch.

## 2026-06-20T07:50:40+02:00 - Messages State Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Implemented `RepairOsBusinessCard as="div"` convergence for Messages template load error, no-template empty state, and no-match group rows in `src/features/messages/screens/messages-screen.tsx`.
- Updated `docs/REPAIRDESK_FIGMA_UI_SYSTEM.md` with Messages Status Notice / Business Card guidance.
- Focused screenshots captured:
  - `screenshots/figma-ui-system-20260620/messages-template-load-error-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/messages-template-load-error-card-mobile.png`
  - `screenshots/figma-ui-system-20260620/messages-template-empty-state-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/messages-template-empty-state-card-mobile.png`
- Verification passed: scoped `git diff --check`, `npm run typecheck`, `npm run lint`, targeted Messages Vitest file, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and focused browser screenshot checks.
- Full `npm run test` was attempted and still fails because Vitest collects Playwright specs inside `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST/source/tests/e2e`; non-export root tests reported 77 files and 461 tests passed before the suite failure.
- Known environment denials repeated: sandboxed build Turbopack port binding, sandboxed dev `listen EPERM`, and sandboxed Chromium `bootstrap_check_in` permission denial.
- Dev server was stopped and port `3019` was released.
- No protected mobile order detail, mobile order information, or mobile work-order management files were edited in this batch.

## 2026-06-20T08:04:18+02:00 - Settings State Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Implemented `RepairOsBusinessCard as="div"` convergence for Settings load-error feedback in `src/features/settings/screens/settings-screen.tsx`.
- Restored reachable Settings error rendering by moving `settingsQuery.isError` before the `!draft` loading fallback.
- Updated `docs/REPAIRDESK_FIGMA_UI_SYSTEM.md` with Settings Status Notice / Business Card guidance.
- Focused screenshots captured:
  - `screenshots/figma-ui-system-20260620/settings-load-error-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/settings-load-error-card-mobile.png`
- Verification passed: scoped `git diff --check`, `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and focused browser screenshot checks.
- Full `npm run test` was attempted and still fails because Vitest collects Playwright specs inside `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST/source/tests/e2e`; non-export root tests reported 77 files and 461 tests passed before the suite failure.
- Known environment denials repeated: sandboxed build Turbopack port binding, sandboxed dev `listen EPERM`, and sandboxed Chromium `bootstrap_check_in` permission denial.
- Dev server was stopped and port `3020` was released.
- No protected mobile order detail, mobile order information, or mobile work-order management files were edited in this batch.

## 2026-06-20T08:13:52+02:00 - Platform State Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Implemented `RepairOsBusinessCard as="div"` convergence for Platform onboarding queue load-error and empty-state feedback in `src/features/platform/screens/platform-admin-screen.tsx`.
- Added `data-ui="platform-onboarding-load-error"` and `data-ui="platform-onboarding-empty-state"` for focused visual verification.
- Updated `docs/REPAIRDESK_FIGMA_UI_SYSTEM.md` with Platform Status Notice / Business Card guidance.
- Focused screenshots captured:
  - `screenshots/figma-ui-system-20260620/platform-onboarding-load-error-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/platform-onboarding-load-error-card-mobile.png`
  - `screenshots/figma-ui-system-20260620/platform-onboarding-empty-state-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/platform-onboarding-empty-state-card-mobile.png`
- Verification passed: scoped `git diff --check`, `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and focused browser screenshot checks.
- Full `npm run test` was attempted and still fails because Vitest collects Playwright specs inside `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST/source/tests/e2e`; non-export root tests reported 77 files and 461 tests passed before the suite failure.
- Known environment denials repeated: sandboxed build Turbopack port binding, sandboxed dev `listen EPERM`, and sandboxed Chromium `bootstrap_check_in` permission denial.
- Dev server was stopped and port `3021` was released.
- No protected mobile order detail, mobile order information, or mobile work-order management files were edited in this batch.

## 2026-06-20T08:25:30+02:00 - Dashboard State Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Implemented `RepairOsBusinessCard as="div"` convergence for the Dashboard partial-data warning and recent-orders empty-state feedback in `src/features/dashboard/screens/dashboard-screen.tsx`.
- Added `data-ui="dashboard-partial-data-warning"` and `data-ui="dashboard-recent-orders-empty"` for focused visual verification and future QA hooks.
- Updated `docs/REPAIRDESK_FIGMA_UI_SYSTEM.md` with Dashboard Status Notice / Business Card guidance.
- Focused screenshots captured:
  - `screenshots/figma-ui-system-20260620/dashboard-state-cards-desktop.png`
  - `screenshots/figma-ui-system-20260620/dashboard-state-cards-mobile.png`
- Verification passed: scoped `git diff --check`, `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and focused browser screenshot checks.
- Full `npm run test` was attempted and still fails because Vitest collects Playwright specs inside `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST/source/tests/e2e`; non-export root tests reported 77 files and 461 tests passed before the suite failure.
- Known environment denials repeated: sandboxed build Turbopack port binding, sandboxed dev `listen EPERM`, and sandboxed Chromium `bootstrap_check_in` permission denial.
- No protected mobile order detail, mobile order information, or mobile work-order management files were edited in this batch.

## 2026-06-20T08:32:40+02:00 - Customer Empty Line Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Implemented `RepairOsBusinessCard as="div"` convergence for customer detail empty activity/order/follow-up lines in `src/features/customers/components/customer-profile-blocks.tsx`.
- Added `data-ui="customer-empty-line"` for focused visual verification and future QA hooks.
- Updated `docs/REPAIRDESK_FIGMA_UI_SYSTEM.md` with customer detail empty-state Business Card guidance.
- Focused screenshots captured:
  - `screenshots/figma-ui-system-20260620/customer-empty-line-business-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/customer-empty-line-business-card-mobile.png`
- Verification passed: scoped `git diff --check`, `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and focused browser screenshot checks.
- Full `npm run test` was attempted and still fails because Vitest collects Playwright specs inside `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST/source/tests/e2e`; non-export root tests reported 77 files and 461 tests passed before the suite failure.
- Known environment denials repeated: sandboxed build Turbopack port binding and sandboxed Chromium `bootstrap_check_in` permission denial; non-sandbox dev server was used for screenshot verification.
- Dev server was stopped and port `3023` was released.
- No protected mobile order detail, mobile order information, or mobile work-order management files were edited in this batch.

## 2026-06-20T08:41:00+02:00 - Inventory Detail Empty Line Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Implemented `RepairOsBusinessCard as="div"` convergence for Inventory detail attachment, timeline, risk/deduction, and financial-ledger empty lines in `src/features/inventory/screens/inventory-screen.tsx`.
- Added `data-ui="inventory-detail-empty-line"` for focused visual verification and future QA hooks.
- Updated `docs/REPAIRDESK_FIGMA_UI_SYSTEM.md` with inventory detail empty-state Business Card guidance.
- Focused screenshots captured:
  - `screenshots/figma-ui-system-20260620/inventory-detail-empty-line-business-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/inventory-detail-empty-line-business-card-mobile-bottom.png`
- Verification passed: scoped `git diff --check`, `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, `npm run agents:check`, and focused browser screenshot checks.
- Full `npm run test` was attempted and still fails because Vitest collects Playwright specs inside `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST/source/tests/e2e`; non-export root tests reported 77 files and 461 tests passed before the suite failure.
- Known environment denials repeated: sandboxed build Turbopack port binding and sandboxed Chromium `bootstrap_check_in` permission denial; non-sandbox dev server was used for screenshot verification.
- Dev server was stopped and port `3024` was released.
- No protected mobile order detail, mobile order information, or mobile work-order management files were edited in this batch.

## 2026-06-20T08:50:16+02:00 - Customer Detail State Business Card Batch

- Figma metadata/read-only discovery remains blocked by the same Figma MCP Starter tool-call limit.
- Implemented `RepairOsBusinessCard as="div"` convergence for Customer detail full-load error and inline refresh warning in `src/features/customers/screens/customer-detail-screen.tsx`.
- Added `data-ui="customer-detail-load-error"` and `data-ui="customer-detail-refresh-warning"` for focused visual verification and future QA hooks.
- Updated `docs/REPAIRDESK_FIGMA_UI_SYSTEM.md` with customer detail failure-state Business Card guidance.
- Focused screenshots captured:
  - `screenshots/figma-ui-system-20260620/customer-detail-load-error-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/customer-detail-load-error-card-mobile.png`
- Verification passed: scoped `git diff --check`, `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, and focused browser screenshot checks.
- Full `npm run test` was attempted and still fails because Vitest collects Playwright specs inside `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST/source/tests/e2e`; non-export root tests reported 77 files and 461 tests passed before the suite failure.
- Known environment denial repeated: sandboxed build Turbopack port binding; non-sandbox build passed and non-sandbox dev server was used for screenshot verification.
- Dev server was stopped and port `3025` was released.
- No protected mobile order detail, mobile order information, or mobile work-order management files were edited in this batch.

## 2026-06-20T09:00:04+02:00 - Buyback Empty-State Business Card Batch

- Figma-first objective updated per owner direction: design Figma page/component targets first; desktop should prefer compact one-page task-critical density where feasible; mobile/desktop should borrow information hierarchy from the current mobile order detail standard.
- Figma remains blocked by the Starter MCP tool-call limit, so the actual Figma target is still incomplete.
- Stabilized one already-applied local non-protected batch: Buyback empty state uses `RepairOsBusinessCard as="div"` with `data-ui="buyback-empty-state"`, and buyback mobile side metrics use `RepairOsInfoTile`.
- Screenshots captured:
  - `screenshots/figma-ui-system-20260620/buyback-empty-state-business-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/buyback-empty-state-business-card-mobile.png`
- Verification passed for this batch: scoped diff check, typecheck, lint, root Vitest excluding `exports/**`, non-sandbox build, and focused Playwright screenshot checks.
- Keep future work Figma-first; do not expand broad local refactors before Figma resumes, except for stabilizing already-applied reversible batches.

## 2026-06-20T09:10:39+02:00 - Figma Blueprint Runner Preparation

- Figma metadata retry still failed with the Starter MCP call limit; the actual Figma target is still incomplete.
- Added local Figma-first design source artifacts:
  - `docs/REPAIRDESK_FIGMA_DESIGN_BLUEPRINT.md`
  - `tools/figma/repairdesk-ui-system-blueprint.json`
  - `tools/figma/use-figma-create-repairdesk-ui-system.mjs`
- The blueprint covers three required Figma pages, core UI components, desktop/mobile targets, desktop one-page density direction, and protected mobile order boundaries.
- The runner script is staged by `RUN_MODE` for incremental future Figma writes.
- Validation passed: blueprint JSON parse and use_figma script syntax compilation.
- Continue with real Figma writes when the MCP limit clears or the plan is upgraded; do not mark this as Figma visual completion.

## 2026-06-20T09:16:15+02:00 - Figma Payloads and Storyboard Preparation

- Figma metadata retry still failed with the Starter MCP call limit; actual Figma target remains incomplete.
- Added generator: `tools/figma/build-repairdesk-figma-artifacts.mjs`.
- Generated 10 per-run-mode `use_figma` JSON payloads and 10 JS payload scripts under `tools/figma/generated/use-figma-payloads/`.
- Generated local storyboard preview: `tools/figma/generated/repairdesk-ui-system-storyboard.html`.
- Visual evidence: `screenshots/figma-ui-system-20260620/repairdesk-figma-storyboard.png`.
- Verification passed: payload JSON parse, payload JS syntax compile, manifest coverage, storyboard DOM coverage, and no storyboard horizontal overflow.
- This remains preparatory Figma work only; live Figma design completion still requires MCP access.

## 2026-06-20T11:14:12+02:00 - Figma Motion and UI Polish Local Execution

- Owner asked to implement the approved Figma UI + motion plan until completion.
- Current goal already exists; live Figma MCP remains blocked by the Starter tool-call limit, so actual Figma page/component/prototype write could not be completed.
- Implemented the controllable local Figma execution layer:
  - Blueprint now includes visual polish rules, motion principles, motion tokens, required component states, reduced-motion guidance, and Prototype flow targets.
  - Runner now generates motion-token boards, component state-matrix boards, and page-level Prototype flow boards.
  - Storyboard generator now renders motion token cards, state matrix, Prototype flow cards, and mobile state-feedback cards.
  - Manifest records motion tokens, interaction states, Prototype flows, protected mobile order surfaces, and all 10 run modes.
- Added a narrow ESLint ignore for Figma MCP snippet files because their top-level `return` is valid in `use_figma` but invalid as ordinary JS source.
- Regenerated staged `use_figma` payloads and local storyboard.
- Verification passed:
  - JSON parse check for blueprint, manifest, and 10 generated payload JSON files.
  - AsyncFunction parse check for 10 generated `use_figma` JS scripts.
  - Non-sandbox Playwright screenshot/DOM verification for the storyboard.
  - `npm run lint`.
  - `npm run agents:check`.
- Visual evidence:
  - `screenshots/figma-ui-system-20260620/repairdesk-figma-motion-storyboard.png`
- Protected mobile order surfaces were not edited.
- Next action remains: when the Figma MCP limit clears or the owner upgrades the Figma plan, run the staged payloads in order and capture real Figma metadata/screenshots.

## 2026-06-20T11:32:28+02:00 - Figma Live Resume Retry Still Blocked

- Retried live Figma metadata for `j7sAvwPMcA43F2cOg7B3Kf`.
- The Figma MCP tool still returned the Starter plan call-limit paywall before any metadata or write could run.
- No generated payload was executed, because the required read-only Figma gate failed.
- No files outside task memory were changed in this retry.
- Continue only after the Figma MCP limit clears or the owner upgrades the Figma plan; then run `tools/figma/generated/use-figma-payloads/overview-foundations.json` first.

## 2026-06-20T11:43:35+02:00 - Page Planning Storyboard Ready

- Continued locally because live Figma remained blocked on the last read-only metadata gate.
- `pageDesignPlans` now defines page-level implementation planning for Dashboard, Orders desktop queue, Customers, Inventory, Buyback, Messages, Settings, and Platform admin.
- The planning schema covers desktop zones, mobile zones, primary actions, states, density targets, motion flows, and acceptance criteria.
- Future `use_figma` page payloads now include a `Page Design Plan / Desktop + Mobile` board after each page's prototype-flow board.
- Local storyboard now renders the page planning layer and was screenshot-verified:
  - `screenshots/figma-ui-system-20260620/repairdesk-figma-page-planning-storyboard.png`
- Verification passed: generated payloads, JSON parse, payload JS syntax, storyboard DOM counts, `git diff --check`, `npm run lint`, and `npm run agents:check`.
- Protected mobile order detail, mobile order information, mobile order list management, and mobile work-order management remain untouched.

## 2026-06-20T17:52:17+02:00 - Inventory Buyback Mobile Card Density Polished

- Owner asked to further optimize the mobile inventory buyback source card internals: remove repeated descriptions, make values more direct, improve visual hierarchy/color, and improve edit operation access.
- Scoped implementation to `src/features/inventory/screens/inventory-screen.tsx` only.
- Did not edit protected mobile order surfaces:
  - `src/features/orders/screens/order-detail-screen.tsx`
  - `src/features/orders/screens/order-list-screen.tsx`
  - `src/features/orders/components/order-list-mobile-header.tsx`
  - `src/features/orders/screens/order-task-screen.tsx`
- UI changes:
  - Buyback source header now keeps the status pill and exposes a direct `编辑` action for price/cost edits.
  - Replaced repeated descriptive rows with direct dense metrics: `报价`, `实付`, `整备`, `总成本`, `凭证`.
  - Merged quote expiry into the quote metric meta and removed the separate duplicate quote/fee row.
  - Cost composition now shows direct split rows for actual paid cost, repair cost, and other fees.
  - Risk/proof blocks now use direct `待补` / `无扣减` wording instead of longer empty-state descriptions.
  - Price/cost edit dialog is renamed to `编辑价格 / 成本`, shows current cost/list/profit summary, and orders fields as回收实付 -> 维修/整备 -> 其他费用 -> 挂牌价.
- Verification passed:
  - `npx prettier --write src/features/inventory/screens/inventory-screen.tsx`
  - `git diff --check -- src/features/inventory/screens/inventory-screen.tsx`
  - `npm run typecheck`
  - `npm run lint`
  - `npx vitest run --exclude "exports/**" src/features/inventory/model/inventory-buyback-summary.test.ts src/features/inventory/model/inventory-workflow.test.ts src/features/inventory/testing/mock-api.test.ts`
  - `npm run build` passed in non-sandbox mode; the sandbox build still hits the known Turbopack port-binding permission issue.
- Visual evidence:
  - `screenshots/figma-ui-system-20260620/inventory-buyback-source-card-final-3col-mobile.png`
  - `screenshots/figma-ui-system-20260620/inventory-buyback-source-edit-dialog-final-mobile.png`
- Playwright 390px overflow metrics passed:
  - Detail card: `innerWidth=390`, `scrollWidth=390`, `bodyScrollWidth=390`; dialog bounds `x=12`, `width=366`.
  - Edit dialog: `innerWidth=390`, `scrollWidth=390`, `bodyScrollWidth=390`; dialog bounds `x=12`, `width=366`.

## Next

- When the Figma MCP limit clears or the plan is upgraded, run generated payloads in order:
  - `overview-foundations`
  - `components-core`
  - each `page-*` target
- For each page payload, verify the desktop/mobile frames, prototype board, and new page-planning board before moving to the next target.
