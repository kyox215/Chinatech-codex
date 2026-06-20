# Handoff

## Current State

Task is active. A new Figma file has been created:

- File: `RepairDesk UI System 2026`
- Key: `j7sAvwPMcA43F2cOg7B3Kf`
- URL: `https://www.figma.com/design/j7sAvwPMcA43F2cOg7B3Kf`

The Figma portion is currently blocked by the Figma MCP Starter tool-call limit. Foundations were partially written:

- RepairDesk color, spacing, radius, and density variables were created before the first call stopped.
- RepairDesk text styles, paint styles, and effect styles were created successfully on retry.
- Component/page generation did not complete because the MCP call limit blocked the next write.

Local non-protected refactor progress has continued while Figma is blocked:

- `src/lib/ui-patterns.ts` exports the shared `pageHeader` declaration.
- `src/shared/ui/repair-os-mobile.tsx` extends `RepairOsModuleHeader` with title/subtitle/eyebrow/action support.
- `RepairOsListScaffold` can render a default desktop header with `eyebrow`, `title`, `subtitle`, and optional `desktopAction`.
- `RepairOsListScaffold` can also render `desktopHeaderAddon` below the default desktop header for KPI grids and metric strips.
- `RepairOsSectionHeader` is exported from the shared RepairOS UI layer for dense section titles with optional descriptions, icons, and right-side actions/badges.
- `RepairOsInfoTile`, `RepairOsInfoGrid`, and `RepairOsInfoLine` are exported from the shared RepairOS UI layer for dense info cards, metric tiles, and data rows.
- Dashboard, customers, inventory, buyback, messages, settings, and platform admin desktop headers use the unified compact pattern.
- `src/features/customers/components/customer-hero.tsx` uses `pageHeader` for the customer detail desktop/dialog hero.
- `src/features/messages/screens/messages-screen.tsx` uses the scaffold default desktop header, with mobile icon action and desktop full save action separated.
- Dashboard, Settings, Messages, Platform admin, and Buyback record detail section titles started migrating to `RepairOsSectionHeader`.
- Customer detail panels and Inventory detail dialog/drawer section titles also use `RepairOsSectionHeader`.
- Customer detail metrics/profile blocks now use `RepairOsInfoTile`.
- Customer detail mobile floating-header metrics and desktop summary-rail metrics now use `RepairOsInfoTile`.
- Inventory detail finance tiles use `RepairOsInfoTile`, and product/check data rows use `RepairOsInfoGrid`.
- Buyback quote workspace local `SectionTitle`, `InfoMetric`, `MetricPill`, and `InfoLine` now delegate to shared RepairOS primitives.
- Buyback record detail local `RecordMetric` now delegates to `RepairOsInfoTile`.
- Dashboard KPI metric cards and Platform approval dialog info fields now delegate to `RepairOsInfoTile`.
- `RepairOsInfoTile` supports optional `leading`, `trailing`, and `meta` slots for dense icon-plus-data blocks.
- Buyback mobile inline customer/device/quote information blocks now delegate to `RepairOsInfoTile`.
- `RepairOsBusinessCard` supports optional leading/body/trailing slots for dense business card/action-row variants, plus `as="article" | "button" | "div" | "label"` for semantic card/action shells.
- `RepairOsBusinessCard` slot grid classes now override dense card default grid columns, so leading/body/trailing layouts stay stable when combined with `repairOs.businessCardDense`.
- Dashboard task cards, quick module links, recent order cards, and recent-order skeletons now delegate to `RepairOsBusinessCard`.
- Customer detail device cards, order rows, contact records, and followup rows now delegate to `RepairOsBusinessCard`.
- Settings section titles call `RepairOsSectionHeader` directly, and settings readiness/member/invitation rows delegate to `RepairOsBusinessCard`.
- Dashboard section titles call `RepairOsSectionHeader` directly without a local `SectionTitle` wrapper.
- Platform admin mobile request cards now delegate to `RepairOsBusinessCard`.
- Inventory mobile list cards now delegate to `RepairOsBusinessCard`.
- Customer tag selection rows now delegate to `RepairOsBusinessCard as="label"` with native checkbox semantics; row text clicks toggle the checkbox on desktop and mobile.
- `docs/COMPONENT_GENERATION_DECLARATION.md` documents compact selection-row semantics for `RepairOsBusinessCard as="label"`.
- Customer list KPI cards and mobile next-step blocks now delegate to `RepairOsInfoTile`; customer list queries, pagination, preview dialog, and create flow remain unchanged.
- `docs/COMPONENT_GENERATION_DECLARATION.md` documents KPI/metric cards as `RepairOsInfoTile` slot candidates.
- Message template selection rows and variable insertion rows now delegate to `RepairOsBusinessCard as="button"`; template save/reset/preview and variable insertion behavior remain unchanged.
- `docs/COMPONENT_GENERATION_DECLARATION.md` and `docs/REPAIRDESK_FIGMA_UI_SYSTEM.md` document compact action rows as `RepairOsBusinessCard as="button"` candidates.
- Buyback quote selected-estimate summary rows and boolean condition/inspection toggle rows now delegate to `RepairOsBusinessCard`; quote calculation, save/defer/reject, attachments, and inventory handoff remain unchanged.
- Buyback quote iPhone model, storage-capacity, battery-health, and iPhone series picker cards now delegate to `RepairOsBusinessCard as="button"`; model reset, storage market suggestion, battery deduction, selected-series filtering, quote calculation, and inventory handoff remain unchanged.
- Generic Buyback quote `ChoiceGroup` option chips now delegate to `RepairOsBusinessCard as="button"`; screen/body condition, document type, signature status, quote calculation, and inventory handoff remain unchanged.
- Customer list mobile device-count, work-state, payment-state, and tag chips now delegate to `RepairOsBadge`; customer list queries, pagination, preview dialog, create flow, and detail links remain unchanged.
- Buyback quote attachment capture cards now delegate to `RepairOsBusinessCard as="label"` with the native file input inside the label card and the reset action outside it; file/camera capture, attachment state, quote save/defer/reject, and inventory handoff remain unchanged.
- Inventory SeaTable import preview now delegates to `RepairOsBusinessCard` plus `RepairOsInfoTile` summary metrics; CSV preview/apply mutations, import mapping, inventory queries, and order screens remain unchanged.
- Settings workflow transition target rows now delegate to `RepairOsBusinessCard as="div"` with checkbox, status label, and primary-target button slots; workflow transition mutation behavior, source status selection, and primary-target behavior remain unchanged.
- The settings workflow transition panel has `data-ui="settings-workflow-transitions"` for focused screenshot/DOM verification.
- Messages template enable toggle and template health notices now delegate to `RepairOsBusinessCard as="div"` with switch/status slots; template save, reset, preview, variable insertion, and message template API behavior remain unchanged.
- The messages template enable and health components expose `data-ui="messages-template-enabled-toggle"` and `data-ui="messages-template-health"` for focused screenshot/DOM verification.
- Latest visual evidence for the series picker:
  - `screenshots/figma-ui-system-20260620/buyback-series-business-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/buyback-series-business-card-mobile.png`
- Latest visual evidence for generic ChoiceGroup chips:
  - `screenshots/figma-ui-system-20260620/buyback-choicegroup-business-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/buyback-choicegroup-business-card-mobile.png`
- Latest visual evidence for customer list badge internals:
  - `screenshots/figma-ui-system-20260620/customer-list-badge-internals-desktop.png`
  - `screenshots/figma-ui-system-20260620/customer-list-badge-internals-mobile.png`
- Latest visual evidence for Buyback attachment capture cards:
  - `screenshots/figma-ui-system-20260620/buyback-attachment-business-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/buyback-attachment-business-card-mobile.png`
- Latest visual evidence for Inventory import preview cards:
  - `screenshots/figma-ui-system-20260620/inventory-import-preview-business-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/inventory-import-preview-business-card-mobile.png`
- Latest visual evidence for Settings workflow transition rows:
  - `screenshots/figma-ui-system-20260620/settings-workflow-transition-panel-desktop.png`
  - `screenshots/figma-ui-system-20260620/settings-workflow-transition-panel-mobile.png`
- Latest visual evidence for Messages template enable and health cards:
  - `screenshots/figma-ui-system-20260620/messages-template-enable-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/messages-template-enable-card-mobile.png`
  - `screenshots/figma-ui-system-20260620/messages-template-health-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/messages-template-health-card-mobile.png`
- Verification passed through lint, typecheck, root-project Vitest excluding `exports/**`, non-sandbox build, agent checks, and browser screenshots.

## 2026-06-20T07:18:49+02:00 - Customer List State Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Customer list refresh warning, empty state, load error, and pagination controls now delegate to `RepairOsBusinessCard as="div"` slot layouts.
- Added `data-ui="customer-list-refresh-warning"`, `data-ui="customer-list-empty-state"`, `data-ui="customer-list-pagination"`, and `data-ui="customer-list-load-error"` for focused visual verification and future QA hooks.
- This batch did not change customer search, filters, pagination state, customer preview, create customer mutation, API calls, or any order screens.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/customer-list-pagination-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/customer-list-pagination-card-mobile.png`
  - `screenshots/figma-ui-system-20260620/customer-list-empty-state-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/customer-list-empty-state-card-mobile.png`
- Playwright DOM checks confirmed `/customers` rendered the pagination card and empty-state card on desktop/mobile, with document overflow `0`, pagination overflow `0`, and empty-state overflow `0`.
- Verification passed: `git diff --check`, `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, browser screenshot checks, and `npm run agents:check`.
- Full `npm run test` still fails because Vitest collects exported Playwright specs under `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST/source/tests/e2e`; this is outside the root-project Vitest scope used by the current validation ladder.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Sandboxed `npm run dev` failed with the known `listen EPERM` port denial; non-sandbox dev server was used for screenshot verification.
- Sandboxed Playwright failed with the known macOS Chromium bootstrap permission denial; the non-sandbox screenshot pass succeeded.
- Protected order files remain dirty from the existing worktree state, but this Customer list state batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T07:28:48+02:00 - Inventory KPI InfoTile Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Inventory header KPI cards now delegate to `RepairOsInfoTile` inside `repairOs.metricCard`.
- Added `data-ui="inventory-kpi-strip"` to the desktop KPI strip and `data-ui="inventory-kpi-card"` to each KPI card for focused visual verification.
- This batch did not change inventory stats queries, list filters, item card behavior, import flow, API calls, or any order screens.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/inventory-kpi-info-tile-desktop.png`
  - `screenshots/figma-ui-system-20260620/inventory-kpi-mobile-route.png`
- Playwright DOM checks confirmed `/inventory` rendered 4 desktop KPI cards, desktop document overflow `0`, desktop KPI strip overflow `0`, and mobile document overflow `0`.
- The mobile screenshot was intentionally cropped to the non-sensitive header/search/chips area because the full mobile viewport included inventory sample item details.
- Verification passed: `git diff --check`, `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, browser screenshot checks, and `npm run agents:check`.
- Full `npm run test` still fails because Vitest collects exported Playwright specs under `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST/source/tests/e2e`; non-export root tests reported 77 files and 461 tests passed before the suite failure.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Sandboxed `npm run dev` failed with the known `listen EPERM` port denial; non-sandbox dev server was used for screenshot verification.
- Sandboxed Playwright failed with the known macOS Chromium bootstrap permission denial; the non-sandbox screenshot pass succeeded.
- Protected order files remain dirty from the existing worktree state, but this Inventory KPI batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T07:40:07+02:00 - Inventory Error Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Inventory load and inline refresh errors now delegate to `RepairOsBusinessCard as="div"` slot layouts in `src/features/inventory/screens/inventory-screen.tsx`.
- Added `data-ui="inventory-load-error"`, `data-ui="inventory-load-error-compact"`, and `data-ui="inventory-inline-error"` for focused visual verification and future QA hooks.
- This batch did not change inventory list/stats queries, filters, retry callbacks, API routes, import flow, item card behavior, or any order screens.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/inventory-load-error-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/inventory-load-error-card-mobile.png`
- Playwright route interception forced `/api/repairdesk/inventory/list` to return 500; desktop and mobile rendered `data-ui="inventory-load-error"` with document overflow `0` and component overflow `0`.
- Verification passed: `git diff --check`, `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, browser screenshot checks, and `npm run agents:check`.
- Full `npm run test` still fails because Vitest collects exported Playwright specs under `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST/source/tests/e2e`; non-export root tests reported 77 files and 461 tests passed before the suite failure.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Sandboxed `npm run dev` failed with the known `listen EPERM` port denial; non-sandbox dev server was used for screenshot verification.
- Sandboxed Playwright failed with the known macOS Chromium bootstrap permission denial; the non-sandbox screenshot pass succeeded.
- Dev server was stopped and port `3018` was released.
- Protected order files remain dirty from the existing worktree state, but this Inventory error batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T07:50:40+02:00 - Messages State Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Messages template load error, no-template empty state, and no-match group rows now delegate to `RepairOsBusinessCard as="div"` slot layouts in `src/features/messages/screens/messages-screen.tsx`.
- Added `data-ui="messages-template-load-error"`, `data-ui="messages-template-empty-state"`, and `data-ui="messages-template-group-empty"` for focused visual verification and future QA hooks.
- This batch did not change message template query keys, save/reset mutations, preview rendering, variable insertion, API routes, or any order screens.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/messages-template-load-error-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/messages-template-load-error-card-mobile.png`
  - `screenshots/figma-ui-system-20260620/messages-template-empty-state-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/messages-template-empty-state-card-mobile.png`
- Playwright route interception forced `/api/repairdesk/message-templates` to return 500 for error-state screenshots and `{ data: [] }` for empty-state screenshots; desktop and mobile rendered the target `data-ui` cards with document overflow `0` and component overflow `0`.
- Verification passed: `git diff --check`, `npm run typecheck`, `npm run lint`, `npx vitest run src/features/messages/model/template-renderer.test.ts --exclude "exports/**"`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, browser screenshot checks, and `npm run agents:check`.
- Full `npm run test` still fails because Vitest collects exported Playwright specs under `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST/source/tests/e2e`; non-export root tests reported 77 files and 461 tests passed before the suite failure.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Sandboxed `npm run dev` failed with the known `listen EPERM` port denial; non-sandbox dev server was used for screenshot verification.
- Sandboxed Playwright failed with the known macOS Chromium bootstrap permission denial; the non-sandbox screenshot pass succeeded.
- Dev server was stopped and port `3019` was released.
- A temporary debug screenshot was generated during route-interception diagnosis and then removed; only the four formal evidence screenshots remain.
- Protected order files remain dirty from the existing worktree state, but this Messages state batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T08:04:18+02:00 - Settings State Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Settings load error now delegates to `RepairOsBusinessCard as="div"` slot layout in `src/features/settings/screens/settings-screen.tsx`.
- The Settings error branch now renders before the `!draft` loading fallback, so `/api/repairdesk/settings/store` failures show the intended retry state instead of staying on the loading screen.
- Added `data-ui="settings-load-error"` for focused visual verification and future QA hooks.
- This batch did not change settings API paths, retry callback behavior, store/member/workflow queries, save mutations, or any order screens.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/settings-load-error-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/settings-load-error-card-mobile.png`
- Playwright route interception forced `/api/repairdesk/settings/store` to return 500; desktop and mobile rendered `data-ui="settings-load-error"` with document overflow `0` and component overflow `0`.
- Verification passed: `git diff --check`, `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, browser screenshot checks, and `npm run agents:check`.
- Full `npm run test` still fails because Vitest collects exported Playwright specs under `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST/source/tests/e2e`; non-export root tests reported 77 files and 461 tests passed before the suite failure.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Sandboxed `npm run dev` failed with the known `listen EPERM` port denial; non-sandbox dev server was used for screenshot verification.
- Sandboxed Playwright failed with the known macOS Chromium bootstrap permission denial; the non-sandbox screenshot pass succeeded.
- Dev server was stopped and port `3020` was released.
- Protected order files remain dirty from the existing worktree state, but this Settings state batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T08:13:52+02:00 - Platform State Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Platform onboarding queue load error and empty state now delegate to `RepairOsBusinessCard as="div"` slot layouts in `src/features/platform/screens/platform-admin-screen.tsx`.
- Added `data-ui="platform-onboarding-load-error"` and `data-ui="platform-onboarding-empty-state"` for focused visual verification and future QA hooks.
- This batch did not change platform approval/rejection mutations, platform API paths, onboarding queue sorting/summary logic, dialog behavior, or any order screens.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/platform-onboarding-load-error-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/platform-onboarding-load-error-card-mobile.png`
  - `screenshots/figma-ui-system-20260620/platform-onboarding-empty-state-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/platform-onboarding-empty-state-card-mobile.png`
- Playwright route interception forced `/api/repairdesk/platform/onboarding/requests` to return 500 for error-state screenshots and `{ data: [] }` for empty-state screenshots; desktop and mobile rendered the target `data-ui` cards with document overflow `0` and component overflow `0`.
- Verification passed: `git diff --check`, `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, browser screenshot checks, and `npm run agents:check`.
- Full `npm run test` still fails because Vitest collects exported Playwright specs under `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST/source/tests/e2e`; non-export root tests reported 77 files and 461 tests passed before the suite failure.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Sandboxed `npm run dev` failed with the known `listen EPERM` port denial; non-sandbox dev server was used for screenshot verification.
- Sandboxed Playwright failed with the known macOS Chromium bootstrap permission denial; the non-sandbox screenshot pass succeeded.
- Dev server was stopped and port `3021` was released.
- Protected order files remain dirty from the existing worktree state, but this Platform state batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T08:25:30+02:00 - Dashboard State Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Dashboard partial-data warning and recent-orders empty state now delegate to `RepairOsBusinessCard as="div"` slot layouts in `src/features/dashboard/screens/dashboard-screen.tsx`.
- Added `data-ui="dashboard-partial-data-warning"` and `data-ui="dashboard-recent-orders-empty"` for focused visual verification and future QA hooks.
- This batch did not change dashboard query keys, fallback stat derivation, task links, recent-order card links, API routes, or any order screens.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/dashboard-state-cards-desktop.png`
  - `screenshots/figma-ui-system-20260620/dashboard-state-cards-mobile.png`
- Playwright route interception forced `/api/repairdesk/order-stats` to return 500 and `/api/repairdesk/orders/list-page` to return an empty list; desktop and mobile rendered the target `data-ui` cards with document overflow `0` and component overflow `0`.
- Verification passed: `git diff --check`, `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, browser screenshot checks, and `npm run agents:check`.
- Full `npm run test` still fails because Vitest collects exported Playwright specs under `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST/source/tests/e2e`; non-export root tests reported 77 files and 461 tests passed before the suite failure.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Sandboxed `npm run dev` failed with the known `listen EPERM` port denial; non-sandbox dev server was used for screenshot verification.
- Sandboxed Playwright failed with the known macOS Chromium bootstrap permission denial; the non-sandbox screenshot pass succeeded.
- Dev server was stopped and port `3022` was released.
- Protected order files remain dirty from the existing worktree state, but this Dashboard state batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T08:32:40+02:00 - Customer Empty Line Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Customer detail empty activity/order/follow-up lines now delegate to `RepairOsBusinessCard as="div"` in `src/features/customers/components/customer-profile-blocks.tsx`.
- Added `data-ui="customer-empty-line"` for focused visual verification and future QA hooks.
- This batch did not change customer detail query keys, tab routing, follow-up creation/completion, customer messages, order links, API routes, or any order screens.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/customer-empty-line-business-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/customer-empty-line-business-card-mobile.png`
- Playwright route interception forced `/api/repairdesk/customer/get` to return an empty customer detail; desktop and mobile rendered `data-ui="customer-empty-line"` with document overflow `0` and component overflow `0`.
- Verification passed: `git diff --check`, `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, browser screenshot checks, and `npm run agents:check`.
- Full `npm run test` still fails because Vitest collects exported Playwright specs under `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST/source/tests/e2e`; non-export root tests reported 77 files and 461 tests passed before the suite failure.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Sandboxed Playwright failed with the known macOS Chromium bootstrap permission denial; the non-sandbox screenshot pass succeeded.
- Dev server was stopped and port `3023` was released.
- Protected order files remain dirty from the existing worktree state, but this Customer empty-line batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T08:41:00+02:00 - Inventory Detail Empty Line Business Card Batch

- Figma metadata read-only check remains blocked by the same Figma MCP Starter tool-call limit.
- Inventory detail attachment, timeline, risk/deduction, and financial-ledger empty lines now delegate to `RepairOsBusinessCard as="div"` in `src/features/inventory/screens/inventory-screen.tsx`.
- Added `data-ui="inventory-detail-empty-line"` for focused visual verification and future QA hooks.
- This batch did not change inventory detail query keys, transaction rendering, action dialogs, import flow, status transition behavior, API routes, or any order screens.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/inventory-detail-empty-line-business-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/inventory-detail-empty-line-business-card-mobile-bottom.png`
- Playwright route interception forced `/api/repairdesk/inventory/get` to return a buyback-backed inventory detail with empty attachments, transactions, events, deductions, and risk notes; desktop and mobile rendered `data-ui="inventory-detail-empty-line"` with document overflow `0` and component overflow `0`.
- Verification passed: `git diff --check`, `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, browser screenshot checks, and `npm run agents:check`.
- Full `npm run test` still fails because Vitest collects exported Playwright specs under `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST/source/tests/e2e`; non-export root tests reported 77 files and 461 tests passed before the suite failure.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Sandboxed Playwright failed with the known macOS Chromium bootstrap permission denial; the non-sandbox screenshot pass succeeded.
- Dev server was stopped and port `3024` was released.
- Protected order files remain dirty from the existing worktree state, but this Inventory detail empty-line batch did not edit protected mobile order detail or mobile work-order management files.

## 2026-06-20T08:50:16+02:00 - Customer Detail State Business Card Batch

- Figma metadata and component/page generation remain blocked by the same Figma MCP Starter tool-call limit.
- Customer detail full-load error and inline refresh warning now delegate to `RepairOsBusinessCard as="div"` in `src/features/customers/screens/customer-detail-screen.tsx`.
- Added `data-ui="customer-detail-load-error"` and `data-ui="customer-detail-refresh-warning"` for focused visual verification and future QA hooks.
- Updated `docs/REPAIRDESK_FIGMA_UI_SYSTEM.md` with customer detail Status Notice / Business Card guidance.
- This batch did not change customer detail query keys, tabs, dialogs, customer mutations, order links, API routes, or any order screens.
- Visual evidence captured:
  - `screenshots/figma-ui-system-20260620/customer-detail-load-error-card-desktop.png`
  - `screenshots/figma-ui-system-20260620/customer-detail-load-error-card-mobile.png`
- Playwright route interception forced `/api/repairdesk/customer/get` to return 500; desktop and mobile rendered `data-ui="customer-detail-load-error"` with document overflow `0`.
- Inline refresh warning was code/type verified; it requires cached customer detail data plus a failed refetch and has no separate force-refresh control in the current UI.
- Verification passed: `git diff --check`, `npm run typecheck`, `npm run lint`, `npx vitest run --exclude "exports/**"`, non-sandbox `npm run build`, and focused browser screenshot checks.
- Full `npm run test` still fails because Vitest collects exported Playwright specs under `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST/source/tests/e2e`; non-export root tests reported 77 files and 461 tests passed before the suite failure.
- Sandboxed `npm run build` failed with the known Turbopack process/port sandbox denial; the non-sandbox build passed.
- Dev server was stopped and port `3025` was released.
- Protected order files remain dirty from the existing worktree state, but this Customer detail state-card batch did not edit protected mobile order detail, mobile order information, mobile order list management, or mobile work-order management files.

## Resume Instructions

1. Inspect `.ai-company/memory/tasks/TASK-20260620-014006-repairdesk-figma-ui-system/EVIDENCE.md`.
2. Continue Figma work in file `j7sAvwPMcA43F2cOg7B3Kf` after the Figma MCP call limit clears or the plan is upgraded.
3. Use only three Figma pages because the Starter plan caps this file at three pages:
   - `00 Overview & Foundations`
   - `01 Components`
   - `02 Page Targets & Protected`
4. Continue Figma component/page generation first when the limit clears.
5. If continuing local code batches before Figma resumes, keep changes small, reversible, and limited to non-protected surfaces.
6. Do not change protected mobile order detail or mobile work-order management files.
7. For additional page cleanup, prefer `RepairOsSectionHeader` for dense card/panel titles before adding another local `SectionTitle` helper.
8. For additional metric/profile/detail cleanup, prefer `RepairOsInfoTile`, `RepairOsInfoGrid`, and `RepairOsInfoLine` before adding another local `InfoBox`, `InfoGrid`, or label/value helper.
9. `RepairOsInfoTile` can now cover label/value, label/value/meta, icon-plus-label/value/meta, and label/value/trailing-icon patterns; prefer its `leading`, `trailing`, and `meta` slots for compact business cards before adding a new local inline-info helper.
10. `RepairOsBusinessCard` can now cover standard business cards, button-backed action rows, label-backed compact selection rows, div-backed checkbox-plus-button workflow rows, switch rows, and compact status notices with leading/body/trailing slots; prefer it before hand-writing icon/text/trailing Link card grids, button grids, selection-row grids, or alert/note panels.
11. Remaining local candidates include wrappers that still duplicate shared info primitives without special behavior, such as one-off compact action rows and non-protected confirmation/summary panels.
12. Latest owner direction overrides earlier local-continuation momentum: prioritize actual Figma page/component design first, then use it to guide application-wide UI alignment.
13. Desktop page targets should aim to keep complete task-critical information on one dense page where feasible, borrowing hierarchy from the current mobile order detail standard.
14. The latest stabilized local batch is Buyback empty state / mobile side metrics:

- `src/features/buyback/screens/buyback-screen.tsx`
- `docs/REPAIRDESK_FIGMA_UI_SYSTEM.md`
- `screenshots/figma-ui-system-20260620/buyback-empty-state-business-card-desktop.png`
- `screenshots/figma-ui-system-20260620/buyback-empty-state-business-card-mobile.png`

15. Latest Figma retry still hits the Starter MCP tool-call limit. Use the new local blueprint artifacts as the source for the next Figma execution, but do not treat them as completed Figma work:

- `docs/REPAIRDESK_FIGMA_DESIGN_BLUEPRINT.md`
- `tools/figma/repairdesk-ui-system-blueprint.json`
- `tools/figma/use-figma-create-repairdesk-ui-system.mjs`

16. When Figma resumes, run the `use_figma` runner incrementally by changing `RUN_MODE`, starting with `overview-foundations`, then `components-core`, then each `page-*` target. Validate each Figma frame with metadata and screenshots before moving on.
17. A generator now produces one payload per run mode. Prefer these generated payloads over manual edits to `RUN_MODE`:

- `tools/figma/build-repairdesk-figma-artifacts.mjs`
- `tools/figma/generated/use-figma-payloads/*.json`
- `tools/figma/generated/use-figma-payloads/*.js`

18. The latest local Figma execution layer now includes UI beautification and motion design:

- `motion/instant`, `motion/fast`, `motion/standard`, and `motion/slow` token cards.
- Required component states: default, hover, pressed, focus-visible, disabled, loading, selected, error, and empty.
- Reduced-motion guidance: remove translate/scale, preserve visible state and opacity feedback.
- Prototype flows for desktop row selection, desktop filters, mobile card detail, mutation feedback, and skeleton-to-content.

19. Local visual QA for the pending Figma design is available here:

- `tools/figma/generated/repairdesk-ui-system-storyboard.html`
- `screenshots/figma-ui-system-20260620/repairdesk-figma-storyboard.png`
- `screenshots/figma-ui-system-20260620/repairdesk-figma-motion-storyboard.png`

## Protected Files

- `src/features/orders/screens/order-detail-screen.tsx`
- `src/features/orders/screens/order-list-screen.tsx`
- `src/features/orders/components/order-list-mobile-header.tsx`
- `src/features/orders/components/order-list-items.tsx`
- `src/features/orders/screens/order-task-screen.tsx`

## Verification Still Required

- Figma metadata inspection after creation.
- Screenshot or design context for at least one page target.
- Figma screenshot for the motion token board, component interaction-state board, and at least one Prototype flow board.
- Future local batches still need their own protected-file diff/status summary.
- Figma component/page generation remains unverified until the MCP limit clears.
