# RepairDesk Figma Desktop/Mobile Blueprint

Status: active draft
Owner: UX + Frontend / Integration Lead
Figma file: `https://www.figma.com/design/j7sAvwPMcA43F2cOg7B3Kf`
Companion data: `tools/figma/repairdesk-ui-system-blueprint.json`
Companion runner: `tools/figma/use-figma-create-repairdesk-ui-system.mjs`
Generated payloads: `tools/figma/generated/use-figma-payloads/`
Generated storyboard: `tools/figma/generated/repairdesk-ui-system-storyboard.html`
Storyboard screenshot: `screenshots/figma-ui-system-20260620/repairdesk-figma-storyboard.png`

## Purpose

This is the current source blueprint for completing the RepairDesk Figma work while the live Figma MCP calls are blocked by the Starter tool-call limit.

The final target remains a real Figma design system, not this document. When Figma access resumes, use this blueprint to build the Figma file first, then use the verified Figma pages to guide application refactors.

Run `node tools/figma/build-repairdesk-figma-artifacts.mjs` after changing this blueprint or the base runner. It emits one `use_figma` payload per generation step and a local storyboard preview for visual QA while Figma MCP access is blocked.

## Hard Scope

- Design both desktop and mobile targets before broad code refactors.
- Optimize for compact, high-density business use.
- Desktop pages should show complete task-critical information in one page where feasible.
- Borrow information hierarchy from the current mobile order detail standard.
- Do not redesign or replace protected mobile order information, mobile order detail, or mobile work-order management pages.

Protected implementation surfaces remain:

- `src/features/orders/screens/order-detail-screen.tsx`
- `src/features/orders/screens/order-list-screen.tsx` mobile list and management behavior
- `src/features/orders/components/order-list-mobile-header.tsx`
- `src/features/orders/components/order-list-items.tsx` mobile card behavior
- `src/features/orders/screens/order-task-screen.tsx`

## Required Figma Pages

Starter plan page count requires the file to stay within three pages:

| Page                          | Required content                                                               |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `00 Overview & Foundations`   | Tokens, density rules, typography, layout grid, color intent, protection notes |
| `01 Components`               | Reusable component boards and variants                                         |
| `02 Page Targets & Protected` | Desktop/mobile page targets plus protected mobile order reference frames       |

## Component Set

Each Figma component should be built as a reusable component or clearly named component frame. Component names must match code concepts so Code Connect can be added later.

| Figma component                     | Desktop variant                                     | Mobile variant                                   | Code source                              |
| ----------------------------------- | --------------------------------------------------- | ------------------------------------------------ | ---------------------------------------- |
| `RepairDesk/App Shell`              | Sidebar + AppBar + content rail                     | AppBar + drawer trigger + compact content        | `AppSidebar`, `AppBar`, `CommandPalette` |
| `RepairDesk/List Scaffold`          | Compact header, KPI addon, toolbar, table/card area | Floating header, search row, stepper chips       | `RepairOsListScaffold`                   |
| `RepairDesk/Mobile Floating Header` | N/A                                                 | Back/title/status/id/progress/action cluster     | `repairOs.mobileFloatingHeader*`         |
| `RepairDesk/Business Card`          | Row card with leading/body/trailing slots           | Dense card, action row, label row, status notice | `RepairOsBusinessCard`                   |
| `RepairDesk/Info Tile`              | KPI, finance, inventory, entity metric              | Dense label/value/meta tile                      | `RepairOsInfoTile`                       |
| `RepairDesk/Info Grid`              | Detail data rows                                    | Compact card body rows                           | `RepairOsInfoGrid`                       |
| `RepairDesk/Section Header`         | Panel title with icon and action                    | Card title with icon and helper text             | `RepairOsSectionHeader`                  |
| `RepairDesk/Toolbar`                | Search, filter, segmented controls, export          | Search + filter icon + horizontal chips          | `surfaces.toolbar`, `repairOs.toolbar`   |
| `RepairDesk/Status Badge`           | Status, risk, payment, inventory                    | Same, smaller density                            | `RepairOsBadge`, order badges            |
| `RepairDesk/Bottom Action Bar`      | Dialog/action footer                                | WhatsApp/status/payment actions                  | `repairOs.mobileFloatingPage` patterns   |

## Token Mapping

Use Figma variables when possible. If the local Figma file already contains variables, bind to them instead of hardcoding.

| Token group | Required variables                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| Color       | background, foreground, card, surface panel, surface muted, border panel, primary, success, warn, danger |
| Type        | Inter regular/medium/semi bold, Space Grotesk display, JetBrains Mono numeric                            |
| Radius      | 8, 10, 12, 16, 20, 24                                                                                    |
| Spacing     | 2, 4, 6, 8, 10, 12, 16, 20, 24                                                                           |
| Shadow      | card, overlay, action, workspace                                                                         |
| Density     | comfortable, compact, dense                                                                              |
| Motion      | instant, fast, standard, slow                                                                            |

## Visual Polish Rules

- Use neutral white/card surfaces, thin borders, compact shadows, and restrained status color.
- Do not use marketing-style hero sections, decorative gradients, nested cards, oversized empty space, or one-hue palettes.
- Desktop targets must show KPI strip, toolbar, main workspace, and context panel in the first `1440 x 1024` frame whenever feasible.
- Mobile targets must borrow the protected order-detail hierarchy: floating header, recent history, compact info cards, finance emphasis, attachment/history access, and bottom action bar.
- Color is reserved for current workflow state, risk, primary action, selected state, and status feedback.

## Motion and Interaction System

Figma must include a motion section in `00 Overview & Foundations` and state/flow boards in `01 Components` / `02 Page Targets & Protected`.

| Motion token      | Duration | Easing        | Usage                                                    |
| ----------------- | -------- | ------------- | -------------------------------------------------------- |
| `motion/instant`  | `80ms`   | `ease-in-out` | Badge tone changes, chip selection, inline icon feedback |
| `motion/fast`     | `140ms`  | `ease-out`    | Hover, pressed, focus ring, button loading swap          |
| `motion/standard` | `220ms`  | `ease-in-out` | Dialog, drawer, row expand, tab panel, context rail      |
| `motion/slow`     | `320ms`  | `ease-out`    | First load, empty state, skeleton-to-content transition  |

Rules:

- Motion explains state, hierarchy, and feedback; it is not decorative.
- Animate opacity and transform first; avoid layout-size animation in dense tables/cards.
- High-frequency actions should feel instant and must not wait on long transitions.
- Every motion pattern must have a reduced-motion equivalent: no translate/scale, preserve visible status text and opacity changes.

Required component states:

- `default`
- `hover`
- `pressed`
- `focus-visible`
- `disabled`
- `loading`
- `selected`
- `error`
- `empty`

Prototype flow targets:

| Flow                   | Trigger                            | Transition                                     | Result                                                                 |
| ---------------------- | ---------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| Desktop list selection | Click dense row                    | `motion/standard` opacity + `translateX 12`    | Right context panel opens; selected row and toolbar state update       |
| Desktop filter refine  | Open filter or segmented control   | `motion/fast` opacity + `y 4`                  | Filter panel expands without changing table width                      |
| Mobile card detail     | Tap business card                  | `motion/standard` sheet slide + opacity        | Detail sheet follows floating-header hierarchy and keeps bottom action |
| Mutation feedback      | Save, status change, send, approve | `motion/instant` loading + `motion/fast` toast | Pending state disables action; success/error appears without reflow    |
| Skeleton to content    | Initial load or panel refresh      | `motion/slow` shimmer fade                     | Placeholder occupies final dimensions; dense layout does not jump      |

## Page Targets

### Dashboard

Desktop `1440 x 1024`:

- App shell with selected `概览`.
- One-row KPI strip with today orders, pending quote, unpaid balance, ready pickup.
- Main grid: priority queue, recent orders, quick module actions, operational warnings.
- No hero. No large chart in first viewport.

Mobile `390 x 844`:

- Compact floating list header.
- Search/action row.
- 3-4 metric cards.
- Priority cards and recent orders using `Business Card`.

### Orders Desktop Queue

Desktop `1440 x 1024`:

- Queue-only target; do not imply mobile order list/detail replacement.
- Dense toolbar with search, status stepper, quick filters, export/print.
- Table/grid row target with customer, device, issue, stage, payment, next action, owner.
- Right-side quick preview panel may be designed for desktop only.

Mobile:

- Add a locked note frame: `Protected - do not redesign mobile order info/detail/work-order`.
- Only include a small visual reference map of hierarchy: floating header, info card order, bottom actions.

### Customers CRM

Desktop `1440 x 1024`:

- One-page CRM workspace: left customer search/list, center profile summary and devices, right activity/orders/follow-ups.
- Keep profile, device, order history, next action visible without full-page navigation where feasible.

Mobile `390 x 844`:

- Floating list header, search, stepper chips.
- Customer cards with customer, phone, device count, next action, tags.
- Detail target uses mobile order detail hierarchy: recent history first, then customer, devices, orders, follow-ups.

### Inventory

Desktop `1440 x 1024`:

- KPI strip, scan/search toolbar, supplier/import status, dense SKU table, right detail/financial panel.
- Keep low stock, buyback source, margin, supplier, and action state visible in one workspace.

Mobile `390 x 844`:

- Search + scan entry, status chips, dense stock cards.
- Detail cards: identity, supplier, condition/risk, finance ledger, attachments, history.

### Buyback

Desktop `1440 x 1024`:

- One-page guided quote workspace: model picker, condition choices, estimated price, margin, attachments, record list.
- Avoid marketing hero; prioritize quote creation and inventory handoff.

Mobile `390 x 844`:

- Compact quote workflow, stepper chips, selectable `Business Card` rows.
- Detail hierarchy mirrors mobile order detail: state, history, customer/device, quote/finance, proofs, actions.

### Messages

Desktop `1440 x 1024`:

- Thread-first workspace with left conversation list, center message thread, right order/customer context and templates.
- Keep template health, variable insertion, and send preview visible without leaving page.

Mobile `390 x 844`:

- Thread list first, then conversation detail in sheet/detail flow.
- Template and variable rows use compact action cards.

### Settings

Desktop `1440 x 1024`:

- One-page operations console: store profile, users/roles, workflow transitions, templates, audit readiness.
- Dense section cards, not nested decorative cards.

Mobile `390 x 844`:

- Section card list with workflow/status rows.
- Switches and checkbox/button rows use `Business Card as div`.

### Platform Admin

Desktop `1440 x 1024`:

- Access request queue, approval detail, role/tenant summary, policy notes.
- Keep approve/reject decision context visible in the same page.

Mobile `390 x 844`:

- Dense request cards with status, applicant, reason, tenant, approve/reject actions.

## Page Planning Detail Boards

Each page target now needs a visible `Page Design Plan / Desktop + Mobile` board in Figma. The board sits beside the desktop/mobile frames and is generated by `tools/figma/use-figma-create-repairdesk-ui-system.mjs` after each page pair.

The planning board must show:

- Desktop zones: the concrete information regions that must fit into the desktop first viewport.
- Mobile zones: the card/header/action hierarchy that borrows from the protected mobile order detail standard.
- Primary actions: the high-frequency commands that must remain visible or one tap away.
- Required states: loading, empty, error, selected, disabled/permission, and pending/mutation states.
- Motion intent: which motion token applies to selection, filtering, sheet/rail opening, and mutation feedback.
- Acceptance: what must be true before the page is considered ready for implementation.

| Target               | Desktop planning focus                                             | Mobile planning focus                                             | Critical acceptance                                                          |
| -------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Dashboard            | KPI strip, priority queue, recent orders, quick modules, risk rail | Floating header, metric strip, priority cards, recent activity    | No hero/chart dominates; warnings and next actions are visible immediately   |
| Orders desktop queue | Toolbar, dense rows, batch bar, desktop-only preview rail          | Protected reference note only                                     | No mobile replacement frame is created                                       |
| Customers CRM        | Search/list, profile workspace, devices, activity, follow-ups      | Customer cards, detail sheet, contact actions, status/tag chips   | Desktop list/profile/activity remain visible together                        |
| Inventory            | Stock KPIs, scan toolbar, SKU table, detail/finance rail, import   | Scan entry, stock cards, detail cards, bottom stock actions       | Supplier, margin, stock, risk, and next action are visible together          |
| Buyback              | Quote wizard, margin panel, proof area, record list, handoff       | Quote stepper, choice cards, finance/proof detail, bottom actions | Quote creation is first-screen work; finance emphasis appears before handoff |
| Messages             | Thread list, conversation, template/variable rail, linked context  | Thread cards, conversation sheet, template rows                   | Template health and linked order context are visible                         |
| Settings             | Store, members/roles, workflow, templates, audit readiness         | Section cards, role/status rows, workflow target rows             | It reads as an operations console with visible permission state              |
| Platform admin       | Request queue, decision context, actions, governance notes         | Request cards, decision sheet, risk notes, persistent actions     | Decision context is visible before approve/reject                            |

## Verification Requirements

When Figma access resumes, completion requires:

- Figma metadata confirms all three pages exist.
- Figma component board includes the component set above.
- `02 Page Targets & Protected` includes desktop and mobile frames for Dashboard, Customers, Inventory, Buyback, Messages, Settings, Platform admin, and desktop-only Orders queue.
- Protected mobile order surfaces are represented only as locked/reference notes, not redesigned replacement frames.
- Figma screenshots cover `01 Components`, one desktop page target, and one mobile page target.
- After code refactors resume, run the normal repo gates and visual checks separately.

## Generated Payload Flow

When Figma MCP access resumes:

1. Open `tools/figma/generated/use-figma-payloads/overview-foundations.json` and run it through `use_figma`.
2. Verify metadata and screenshot for foundations, visual polish, and motion-token boards.
3. Run `components-core.json` and confirm component, state-matrix, and component-motion boards.
4. Run each `page-*.json` payload one at a time; each page target includes a desktop/mobile pair plus a prototype-flow board.
5. Keep the mobile order reference frame locked/protected; it is not a redesign target.

The current local visual QA artifact is:

- `tools/figma/generated/repairdesk-ui-system-storyboard.html`
- `screenshots/figma-ui-system-20260620/repairdesk-figma-storyboard.png`
