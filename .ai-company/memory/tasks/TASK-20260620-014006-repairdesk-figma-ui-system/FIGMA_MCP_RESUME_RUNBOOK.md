# Figma MCP Resume Runbook

Use this when the Figma MCP Starter call limit clears.

## File

- Figma file key: `j7sAvwPMcA43F2cOg7B3Kf`
- Figma file URL: `https://www.figma.com/design/j7sAvwPMcA43F2cOg7B3Kf`

## Required Skills

- `figma-use`
- `figma-generate-library`
- `figma-generate-design`

## Resume Sequence

1. Run a read-only metadata check.
2. Ensure exactly three pages exist:
   - `00 Overview & Foundations`
   - `01 Components`
   - `02 Page Targets & Protected`
3. Run generated payloads from `tools/figma/generated/use-figma-payloads/` in this order:
   - `overview-foundations.json`
   - `components-core.json`
   - `page-dashboard.json`
   - `page-orders-desktop.json`
   - `page-customers.json`
   - `page-inventory.json`
   - `page-buyback.json`
   - `page-messages.json`
   - `page-settings.json`
   - `page-platform-admin.json`
4. After each payload, capture or inspect the created board before continuing.
5. Capture screenshots from `00 Overview & Foundations`, `01 Components`, and `02 Page Targets & Protected`.
6. Update `figma-state.json`, `EVIDENCE.md`, and `CHECKPOINTS.md`.

## Three-Page Content Contract

### `00 Overview & Foundations`

- Cover frame with:
  - Goal.
  - Figma method.
  - Refactor targets.
  - Protected mobile scope.
- Foundations frame with:
  - Color swatches.
  - Typography samples.
  - Spacing, radius, and density samples.
  - Motion token samples: `motion/instant`, `motion/fast`, `motion/standard`, `motion/slow`.
  - Layout rules.
  - Visual polish and reduced-motion rules.

### `01 Components`

Create:

- `RepairDesk/Button`
- `RepairDesk/Status Badge`
- `RepairDesk/Input`
- `RepairDesk/Info Card`
- `RepairDesk/Data Row`
- `RepairDesk/Toolbar`
- `RepairDesk/Metric Card`
- `RepairDesk/Business Card`
- `RepairDesk/Section Header`
- `RepairDesk/Mobile Floating Header`
- `RepairDesk/Bottom Action Bar`
- Interaction-state matrix covering default, hover, pressed, focus-visible, disabled, loading, selected, error, and empty states.

Each component must include a description that maps it to the later code target.

### `02 Page Targets & Protected`

Create targets for:

- Dashboard desktop.
- Orders desktop queue only.
- Customers CRM.
- Inventory.
- Buyback.
- Messages.
- Settings.
- Platform admin.
- Protected mobile reference frame.
- Prototype flow boards for desktop list selection, desktop filters, mobile card detail, mutation feedback, and skeleton-to-content.

The protected frame must explicitly say that mobile order detail, mobile order information, mobile order work-order management, and mobile order task workflow are not replacement targets.

## Stop Conditions

Stop and update evidence if any of these happen:

- Figma MCP call limit is reached again.
- Figma Starter page cap prevents page creation.
- Metadata or screenshot capture is blocked.
- Any script would require touching protected mobile order source files.
