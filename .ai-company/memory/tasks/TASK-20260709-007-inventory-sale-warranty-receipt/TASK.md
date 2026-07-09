# TASK-20260709-007 Inventory Sale Warranty Receipt

Status: validating
Owner: Hexiang Huang / 鹤祥
Decision owner: RepairDesk Integration Lead / CEO Agent
Autonomy: L2 bounded execution
Risk: R2 medium
Created: 2026-07-09 Europe/Rome

## Owner Goal

Implement the inventory product add/sale flow from the approved plan, including mobile-friendly product creation, inventory lookup by IMEI/model, customer sale registration, sold status, warranty period, purchase date, receipt printing, and warranty terms.

## Business Value

Chinatech can record phones, tablets, computers, and other electronics into inventory, sell them to customers, print a sale/warranty receipt, and later look up warranty status by IMEI, phone, or inventory number.

## In Scope

- Improve inventory product creation semantics and mobile UI copy for direct merchandise entry.
- Support initial status for product creation where compatible with existing inventory workflow.
- Improve sale registration UI and validation.
- Generate a printable sale/warranty receipt from sold inventory item data.
- Preserve purchase date, warranty period, warranty until date, buyer data, sale price, payment method, and sale timeline.
- Add focused tests for business rules and receipt data generation.
- Verify lint/typecheck/test/build and relevant UI behavior.
- Commit and push scoped changes to `origin/main`.

## Out Of Scope

- No production Supabase migration execution.
- No destructive data operation.
- No real customer message sending.
- No external printer driver integration.
- No automatic refunds, exchanges, or inventory replacement flow.

## Constraints

- Use existing RepairDesk UI and data access patterns.
- Client components must use `@/lib/repairdesk/api`.
- Do not import server modules into client code.
- Keep colors in existing design tokens.
- Avoid schema change unless implementation cannot be safely completed with current columns.
- Worktree must be scoped before commit because prior tasks may leave unrelated files.

## Acceptance Criteria

- Inventory add flow can record category, brand, model, color, storage, IMEI, cost/list price, warranty period, source, and initial status.
- Sale flow records buyer name/phone, sale price, payment method, sale channel, warranty months, warranty until, sold at, notes, event, and transaction.
- Sold item detail exposes print receipt / warranty receipt action.
- Receipt includes store details, item details, IMEI, purchase date, price, payment method, warranty period, warranty until, and warranty terms.
- Mobile layout remains usable at 390px with no page-level horizontal overflow.
- Existing inventory tests pass and new tests cover the added sale receipt logic.

## Agent Plan

No real sub-agent spawned. Reason: available sub-agent tool policy permits spawning only when the user explicitly requests sub-agents/delegation/parallel agent work. Department review is performed by the main thread and recorded here.

Departments considered:
- FLOW: sale and warranty lifecycle.
- DATA/API: existing inventory schema, mock/server parity, no production migration.
- UX/FE: mobile-first inventory dialogs and receipt print action.
- QA: unit tests, build, browser/screenshot evidence.
- SECURITY/PRIVACY: buyer PII limited to existing customer fields and receipt display.

## Verification Plan

- npm run lint
- npm run typecheck
- npm run test
- npm run build
- Browser/mobile checks for `/inventory` if local server can run.
- Screenshot evidence for visible inventory sale/receipt UI where possible.

## Implementation Summary

- Added direct inventory product creation semantics with source type, compatible initial status, warranty months, cost/list price, and optional source contact.
- Kept buyback source records pinned to the existing intake/buyback verification path.
- Added sale receipt snapshot generation on sold inventory items through existing `legacy_payload.sale_receipt`.
- Added mobile/desktop inventory UI copy and controls for "新增库存商品", direct sale registration summary, warranty receipt preview, and A5 print sheet.
- Added unit coverage for receipt data and direct-stock sale flow.

## Validation Summary

- `npm run test -- --run src/features/inventory/model/inventory-sale-receipt.test.ts src/features/inventory/testing/mock-api.test.ts`: passed, 9 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run test`: passed, 92 files / 621 tests.
- `npm run build`: passed after rerunning outside sandbox because Turbopack port binding was blocked by sandbox.

## Visual Evidence Status

- In-app browser backend was unavailable (`agent.browsers.list()` returned empty).
- Starting dev server inside sandbox failed with `listen EPERM`; outside sandbox Next reported another same-project dev server on `localhost:3012`, but sandbox curl could not reach it.
- No screenshot captured in this run. Build route output confirms `/inventory` is included as a static app route.
