# RepairDesk Figma UI System

Status: active
Owner: UX + Frontend / Integration Lead
Figma file: `https://www.figma.com/design/j7sAvwPMcA43F2cOg7B3Kf`
Task memory: `.ai-company/memory/tasks/TASK-20260620-014006-repairdesk-figma-ui-system/`
Current local blueprint: `docs/REPAIRDESK_FIGMA_DESIGN_BLUEPRINT.md`
Figma runner script: `tools/figma/use-figma-create-repairdesk-ui-system.mjs`
Generated Figma payloads: `tools/figma/generated/use-figma-payloads/`
Local storyboard preview: `tools/figma/generated/repairdesk-ui-system-storyboard.html`

## Objective

Use Figma as the design target for a unified RepairDesk UI component system, then refactor non-protected pages toward compact, high-density desktop and mobile layouts.

The design target must preserve the current RepairOS mobile order detail language. Do not redesign or replace protected mobile order surfaces during this initiative.

Latest owner direction: design the Figma component/page targets first, then use that system to align the application. Desktop pages should aim to keep complete task-critical information visible on one dense page where feasible, while mobile and desktop both borrow the current mobile order detail hierarchy for information priority, card density, finance emphasis, scan/photo entry, history, and bottom actions.

## Protected Scope

These areas are locked unless the owner gives a later explicit approval:

- Mobile order detail.
- Mobile order information page behavior.
- Mobile order work-order management.
- Mobile order task/workflow pages.

Protected implementation surfaces include:

- `src/features/orders/screens/order-detail-screen.tsx`
- `src/features/orders/screens/order-list-screen.tsx` mobile list and management sections
- `src/features/orders/components/order-list-mobile-header.tsx`
- `src/features/orders/components/order-list-items.tsx` mobile card behavior
- `src/features/orders/screens/order-task-screen.tsx`

## Current Figma Constraint

The current Figma account is on a Starter plan. The file must stay within three pages, and Figma MCP calls may be rate-limited. If the MCP call limit is reached, continue through local specs and resume Figma writes later.

While the MCP call limit is active, use `docs/REPAIRDESK_FIGMA_DESIGN_BLUEPRINT.md`, `tools/figma/repairdesk-ui-system-blueprint.json`, `tools/figma/use-figma-create-repairdesk-ui-system.mjs`, and the generated payloads under `tools/figma/generated/use-figma-payloads/` as the executable local source for the next Figma pass. These files do not count as Figma completion; they are the prepared source for the next successful Figma write.

Required Figma pages:

1. `00 Overview & Foundations`
2. `01 Components`
3. `02 Page Targets & Protected`

## Current Implementation Status

As of 2026-06-20, Figma foundations exist but page/component generation is blocked by the Figma MCP Starter tool-call limit. Because the latest owner direction is Figma-first, further broad local refactor work should wait for Figma recovery or plan upgrade; local changes should only stabilize already-applied reversible batches and keep specs ready for Figma. Local reversible refactor work has been applied to non-protected surfaces:

- Shared `pageHeader` declaration in `src/lib/ui-patterns.ts`.
- Shared compact title support in `RepairOsModuleHeader`.
- Default desktop header rendering in `RepairOsListScaffold` using `eyebrow`, `title`, `subtitle`, and `desktopAction`.
- Header KPI/Metric addon rendering in `RepairOsListScaffold` using `desktopHeaderAddon`.
- Shared section header component `RepairOsSectionHeader` in `src/shared/ui/repair-os-mobile.tsx`.
- Shared info primitives `RepairOsInfoTile`, `RepairOsInfoGrid`, and `RepairOsInfoLine` in `src/shared/ui/repair-os-mobile.tsx`, matching the Figma component targets for Info Card, Metric Card, and Data Row.
- Desktop headers for Dashboard, Customers, Inventory, Buyback, Messages, Settings, and Platform admin.
- Customer detail desktop/dialog hero in `src/features/customers/components/customer-hero.tsx`.
- Messages page desktop header migrated to the scaffold default header while keeping mobile and desktop actions separate.
- Dashboard, Settings, Messages, Platform admin, and Buyback local section-title patterns started migrating to the shared section header.
- Customer detail panels and Inventory detail drawer section titles also use `RepairOsSectionHeader`, keeping dense business panels aligned across desktop and mobile.
- Customer detail metrics/profile blocks now use `RepairOsInfoTile`.
- Customer detail mobile floating-header metrics and desktop summary-rail metrics also use `RepairOsInfoTile`.
- Inventory detail finance tiles and product/check data rows now use `RepairOsInfoTile` / `RepairOsInfoGrid`; the inventory detail dialog also uses the shared dense dialog shell without the default Dialog grid/padding expansion.
- Buyback quote workspace local `SectionTitle`, metric pills, quote info metrics, and sidebar info lines now delegate to `RepairOsSectionHeader`, `RepairOsInfoTile`, and `RepairOsInfoLine`.
- Buyback record detail quote, device, and proof metric tiles now delegate to `RepairOsInfoTile`.
- Dashboard KPI metric cards and Platform approval dialog info fields now delegate to `RepairOsInfoTile`.
- Inventory header KPI cards now delegate to `RepairOsInfoTile` inside `repairOs.metricCard`, aligning the stock overview metrics with the Figma Metric Card / Info Card target while preserving inventory stats queries and list behavior.
- Inventory load and inline refresh errors now delegate to `RepairOsBusinessCard as="div"` with `data-ui` hooks, aligning inventory failure notices with the Figma Business Card / Status Notice target while preserving retry behavior.
- Inventory detail attachment, timeline, risk/deduction, and financial-ledger empty lines now delegate to `RepairOsBusinessCard as="div"` with `data-ui="inventory-detail-empty-line"`, aligning detail-panel empty states with the Figma Business Card / Status Notice target while preserving inventory detail queries and transaction behavior.
- Customer list KPI cards and mobile customer next-step blocks now delegate to `RepairOsInfoTile`; the primitive supports leading/trailing/meta slots for icon, value, and dense helper content.
- Customer list mobile device-count, work-state, payment-state, and tag chips now delegate to `RepairOsBadge`, aligning customer list card internals with the Figma Status/Tag Chip target while preserving customer list query, pagination, preview, and create flows.
- Customer list refresh warning, empty state, load error, and pagination controls now delegate to `RepairOsBusinessCard as="div"`, aligning list state panels with the Figma Business Card / Status Notice target while preserving search, pagination, preview, and create behavior.
- Customer detail empty activity/order/follow-up lines now delegate to `RepairOsBusinessCard as="div"` with `data-ui="customer-empty-line"`, aligning CRM detail empty states with the Figma Business Card / Status Notice target without changing customer detail queries or order links.
- Customer detail full-load error and inline refresh warning now delegate to `RepairOsBusinessCard as="div"` with focused `data-ui` hooks, aligning CRM detail failure feedback with the Figma Business Card / Status Notice target while preserving retry, back-link, tabs, dialogs, and customer detail query behavior.
- Message template list rows and variable insertion rows now delegate to `RepairOsBusinessCard as="button"` so Figma Action Row and Business Card targets share one implementation shape.
- Message template load error, no-template empty state, and no-match group rows now delegate to `RepairOsBusinessCard as="div"`, extending the Figma Business Card / Status Notice target to messaging list states without changing template query, save, reset, preview, or variable insertion behavior.
- Buyback quote workspace selected-estimate summary rows and boolean inspection toggle rows now delegate to `RepairOsBusinessCard`, covering the Figma Business Card and Action Row targets without changing quote calculation or inventory handoff logic.
- Buyback quote workspace iPhone model selection cards now delegate to `RepairOsBusinessCard as="button"`, aligning the guided intake picker with the Figma Business Card and compact selection-card target while preserving quote reset behavior for storage and market price.
- Buyback quote workspace storage-capacity and battery-health picker cards now delegate to `RepairOsBusinessCard as="button"`, extending the guided intake picker convergence while preserving storage market suggestion and battery deduction behavior.
- Buyback quote workspace iPhone series picker cards now delegate to `RepairOsBusinessCard as="button"`, keeping the guided intake strip aligned with the Figma Business Card and compact selection-card target while preserving selected-series model filtering.
- Buyback quote workspace generic `ChoiceGroup` option chips now delegate to `RepairOsBusinessCard as="button"`, covering screen/body condition, document type, and signature status choices with the same compact Action Row target.
- Buyback quote workspace attachment capture cards now delegate to `RepairOsBusinessCard as="label"` with the file input nested inside the label card and reset kept as a separate action, covering camera/photo/PDF capture rows without changing attachment state or inventory handoff logic.
- Buyback list empty state now delegates to `RepairOsBusinessCard as="div"` and mobile buyback card side metrics now delegate to `RepairOsInfoTile`, extending the Figma Business Card / Info Card targets while preserving quote creation, record detail, inventory handoff, and filtering behavior.
- Inventory SeaTable import preview now uses `RepairOsBusinessCard` plus `RepairOsInfoTile` summary metrics for the Figma Business Card / Info Card targets, while preview/apply mutations and import mapping stay unchanged.
- Settings workflow transition target rows now use `RepairOsBusinessCard` leading/body/trailing slots for checkbox, label, and primary-target action, aligning role/status configuration rows with the Figma Action Row target while preserving workflow mutation behavior.
- Settings load error now delegates to `RepairOsBusinessCard as="div"` with `data-ui="settings-load-error"`, aligning system settings failure feedback with the Figma Business Card / Status Notice target, restoring the reachable failure branch, and preserving retry behavior.
- Platform onboarding queue load error and empty state now delegate to `RepairOsBusinessCard as="div"` with focused `data-ui` hooks, aligning platform admin status feedback with the Figma Business Card / Status Notice target while preserving approve/reject behavior.
- Dashboard partial data warning and recent-orders empty state now delegate to `RepairOsBusinessCard as="div"` with focused `data-ui` hooks, aligning overview status feedback with the Figma Business Card / Status Notice target while preserving dashboard query behavior.
- Messages template enable toggle and health check notices now use `RepairOsBusinessCard` slot layouts for switch rows and status feedback, extending the Figma Action Row / Status Notice target without changing template save, reset, preview, or variable insertion behavior.

The protected mobile order detail, mobile order information behavior, mobile order work-order management, and mobile order task/workflow pages remain out of scope.

## Figma Foundations

Create and maintain these foundations in the Figma file:

| Foundation | Figma target                                             | Code source                                                |
| ---------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| Color      | `RepairDesk / Color` variables with Light and Dark modes | `src/styles.css`                                           |
| Spacing    | `RepairDesk / Space` number variables                    | `src/lib/ui-patterns.ts` density and RepairOS declarations |
| Radius     | `RepairDesk / Radius` number variables                   | `--radius-*` in `src/styles.css`                           |
| Density    | `RepairDesk / Density` number variables                  | `repairOs`, `density`, `componentDensity`                  |
| Type       | `RepairDesk/Desktop/*` text styles                       | `--font-sans`, `--font-display`, `--font-mono`             |
| Effects    | `RepairDesk/Shadow/*` styles                             | `--shadow-card`, `--shadow-overlay`, `--shadow-workspace`  |
| Motion     | `RepairDesk / Motion` notes and prototype boards         | `src/lib/motion.ts`, `framer-motion`, reduced-motion rules |

## Figma Component Set

The first Figma component pass should create these reusable targets:

| Component                   | Purpose                                                           | Later code mapping                                           |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| `RepairDesk/Button`         | Primary, secondary, danger, ghost actions                         | `src/components/ui/button`, `brandGradientStyle`, `controls` |
| `RepairDesk/Status Badge`   | Status, risk, payment, and inventory badges                       | `src/components/orders/badges.tsx`, `toneClasses`            |
| `RepairDesk/Input`          | Dense desktop and mobile form fields                              | `src/components/ui/input`, `componentForm`                   |
| `RepairDesk/Info Card`      | Compact repeated entity card                                      | `componentShell`, `repairOs.businessCardDense`               |
| `RepairDesk/Data Row`       | Stable dense desktop row                                          | `dataDisplay`, `density`, desktop table rows                 |
| `RepairDesk/Toolbar`        | Search, filter, segmented controls, export                        | `surfaces.toolbar`, `repairOs.toolbar`, `controls`           |
| `RepairDesk/Metric Card`    | KPI and finance metrics                                           | `repairOs.metricCardDense`, `componentMetric`                |
| `RepairDesk/Section Header` | Dense panel title, helper text, icon, and right-side badge/action | `RepairOsSectionHeader`, `repairOs.adminSectionHeader`       |

## Figma Motion and Visual Polish Targets

The Figma file must document UI beautification and motion as part of the system, not as optional decoration.

Motion tokens:

- `motion/instant` (`80ms`, `ease-in-out`): badge tone changes, chip selection, inline icon feedback.
- `motion/fast` (`140ms`, `ease-out`): hover, pressed, focus ring, button loading swap.
- `motion/standard` (`220ms`, `ease-in-out`): drawer, dialog, row expand, tab panel, context rail.
- `motion/slow` (`320ms`, `ease-out`): first load, empty state, skeleton-to-content transition.

Required component states:

- `default`, `hover`, `pressed`, `focus-visible`, `disabled`, `loading`, `selected`, `error`, and `empty`.

Prototype coverage:

- Desktop dense-row selection opens a context panel without leaving the list.
- Desktop filters and segmented controls expand without changing table width.
- Mobile business-card tap opens a detail sheet using the floating-header hierarchy.
- Mutation feedback disables the pending action and shows inline error or success toast without layout shift.
- Skeleton loading occupies final layout dimensions before content appears.

Visual polish rules:

- Use neutral card surfaces, thin borders, compact shadows, and focused status color.
- Avoid nested cards, decorative gradients, oversized hero sections, and large marketing-style empty space.
- Respect `prefers-reduced-motion`: disable translate/scale while preserving visible state changes.

## Page Targets

Figma page targets should cover these non-protected screens:

| Target               | Desktop direction                                           | Mobile direction                                           |
| -------------------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| Dashboard            | Dense operations overview with KPI strip and priority queue | Compact metric strip and actionable list                   |
| Orders desktop queue | Desktop queue and filters only                              | Do not replace protected mobile order list/detail behavior |
| Customers CRM        | Search, profile context, device/order history               | High-density cards using existing RepairOS mobile language |
| Inventory            | Supplier intake, low stock, SKU table                       | Dense stock cards and quick scan/filter actions            |
| Buyback              | Guided intake, quote panel, margin checks                   | Preserve compact quote workflow; no marketing hero         |
| Messages             | Inbox, conversation, templates, order context               | Thread-first compact panels                                |
| Settings             | Store, role, workflow, template, audit controls             | Section cards with dense role/status rows                  |
| Platform admin       | Access requests and governance controls                     | Dense request cards                                        |

Each page target also has a required planning board in the generated Figma payloads:

- Desktop zones: first-viewport information regions for one-page decision density.
- Mobile zones: floating header, compact cards, history/finance/attachment/action order borrowed from the protected order detail language.
- Primary actions: create, scan, filter, save, approve, message, handoff, or retry commands that must stay visible or one tap away.
- States: loading, empty, error, selected, disabled/permission, pending, and mutation feedback.
- Motion: page-specific use of `motion/instant`, `motion/fast`, and `motion/standard`.
- Acceptance: the criteria that must pass before code refactor starts for that page.

The authoritative structured source for these planning boards is `pageDesignPlans` in `tools/figma/repairdesk-ui-system-blueprint.json`.

## Code Refactor Order

After Figma page targets are verified, apply code changes in this order:

1. Add missing shared declarations in `src/lib/ui-patterns.ts` and `src/lib/component-patterns.ts`.
2. Refactor Dashboard, Customers, Inventory, Buyback, Messages, Settings, and Platform admin toward those declarations.
3. Refactor desktop-only order queue components if needed.
4. Leave protected mobile order detail and mobile order work-order management unchanged.
5. Run lint, typecheck, test, build, and visual verification.

## Verification Gates

- Figma metadata proves the three required pages exist.
- Figma screenshots cover component library and at least Dashboard plus one dense list target.
- Figma or local storyboard screenshots cover motion tokens, interaction-state matrix, and at least one prototype-flow board.
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- Browser screenshots for changed pages, desktop and mobile viewport.

If Figma remains blocked by plan limits, do not claim visual completion. Record the blocker and continue only with reversible local preparation.
