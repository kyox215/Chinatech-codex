# RepairDesk Figma Page Spec

This spec is the resume target for `RepairDesk UI System 2026` after the Figma MCP Starter call limit clears.

Figma file:

- Key: `j7sAvwPMcA43F2cOg7B3Kf`
- URL: `https://www.figma.com/design/j7sAvwPMcA43F2cOg7B3Kf`

## Page Structure

The owner account is on a Figma Starter plan, so the file must stay within three pages:

1. `00 Overview & Foundations`
   - Cover frame: task scope, Figma method, refactor targets, protected scope.
   - Foundations frame: color variables, typography, spacing, radius, density, layout rules.
2. `01 Components`
   - `RepairDesk/Button` component set.
   - `RepairDesk/Status Badge` component set.
   - `RepairDesk/Input`.
   - `RepairDesk/Info Card`.
   - `RepairDesk/Data Row`.
   - Implementation mapping notes for code refactor.
3. `02 Page Targets & Protected`
   - Dashboard desktop target.
   - Orders desktop queue target.
   - Customers CRM desktop target.
   - Inventory desktop target.
   - Buyback desktop intake target.
   - Messages desktop target.
   - Settings desktop target.
   - Platform Admin desktop/mobile target.
   - Protected mobile reference frame.

## Page Design Planning Matrix

Every page target must include a visible `Page Design Plan / Desktop + Mobile` board next to the page frames. The board is part of the Figma deliverable, not a private note.

| Target               | Desktop zones                                                                 | Mobile zones                                                                    | Required states                                                                | Density target                                                                         |
| -------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Dashboard            | KPI strip, priority queue, recent orders, quick modules, risk rail            | Floating header, metric strip, priority cards, recent activity, bottom actions  | Loading, partial data warning, empty recent orders, selected priority, toast   | Desktop first viewport shows KPIs, priority/recent records, and quick modules          |
| Orders desktop queue | Queue toolbar, dense table, batch bar, desktop-only preview rail              | Protected reference note only; no mobile replacement frame                      | Loading table, empty queue, selected row, batch selected, preview/export state | Desktop first viewport shows toolbar, 12-16 rows, and optional preview rail            |
| Customers CRM        | Customer list, profile workspace, activity rail, KPI addon, state panels      | Customer cards, detail sheet, contact actions, status/tag chips                 | Loading, empty search, refresh warning, full-load error, selected, pending     | Desktop shows list, profile, and activity together; mobile shows 4 cards/sections      |
| Inventory            | Stock KPIs, scan toolbar, dense SKU table, detail/finance rail, import state  | Scan entry, status chips, stock cards, detail cards, bottom stock actions       | Loading, refresh error, empty stock, import preview, detail empty, pending     | Desktop shows KPI, toolbar, 10-14 rows, and rail; mobile shows scan plus 3 cards       |
| Buyback              | Quote wizard, margin panel, proof area, record list, handoff state            | Quote header, stepper chips, choice cards, finance/proof detail, bottom actions | Empty, selected choice, recalculating, attachment pending, handoff, validation | Desktop shows wizard, margin, and records; mobile shows current step and quote summary |
| Messages             | Thread list, conversation, template/variable rail, order context, send states | Thread cards, conversation sheet, template rows, compact actions                | Template disabled, health warning, empty templates, load error, send pending   | Desktop shows inbox, conversation, templates, and context in one surface               |
| Settings             | Store profile, members/roles, workflow, templates, audit readiness            | Section cards, role/status rows, workflow targets, template rows, retry panel   | Loading, load error, pending save, disabled permission, selected, warning      | Desktop reads as an operations console, not decorative cards                           |
| Platform admin       | Request queue, decision context, approval actions, governance notes, states   | Request cards, decision sheet, approve/reject actions, risk notes, empty/error  | Queue loading, empty queue, load error, selected request, pending, error       | Decision context is visible before approve/reject on desktop and mobile                |

## Protected Scope

The following are boundary references only, not replacement targets:

- Mobile order detail.
- Mobile order work-order management.
- Mobile order task workflow.
- Existing mobile detail typography, finance editing, scan/photo entry, history, and bottom actions.

## Later Code Refactor Mapping

Use the Figma output as the later source target for these non-protected code areas:

- Shared primitives: `src/components/ui/*`.
- Shared declarations: `src/lib/ui-patterns.ts` and `src/lib/component-patterns.ts`.
- Desktop order list/queue: desktop-only order list components.
- Customers CRM screens.
- Inventory screens.
- Buyback screens.
- Messages screens.
- Settings screens.

Do not apply broad code refactors until the Figma page targets exist and are verified.
