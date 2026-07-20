# Evidence

## Inputs

- Owner-provided screenshot: records tab shows unequal responsibility cards, a large unused right area, detached secondary tabs, and a full-width timeline using a different alignment boundary.
- Current implementation: `OrderRecordsWorkspace` limits the responsibility row to `lg:max-w-[680px]` inside a `920px` readable workspace.

## Verification results

- `npm run agents:check`: PASS.
- `npm run lint`: PASS after rebasing the latest `main` formatting fix.
- `npm run typecheck`: PASS.
- `npm run test`: PASS, 319 files / 2102 tests.
- `npm run build -- --webpack`: PASS with approved network access for configured Google Fonts.
- `REPAIRDESK_E2E_ORDER_LAYOUT_ONLY=1` Playwright matrix: PASS, 5/5 at 1024, 1280, 1440, 1536, and 1600 pixels.
- Automated UI assertions cover:
  - overview card top/bottom alignment;
  - equal responsibility-card width and height;
  - responsibility row, secondary record group, and timeline shared left/right column lines;
  - two-column key-information grid;
  - no page-level horizontal overflow;
  - negligible records workspace overflow for the three-entry fixture.

## Visual evidence

- `screenshots/TASK-20260720-004-order-detail-alignment-polish/desktop-overview-1440.png`
- `screenshots/TASK-20260720-004-order-detail-alignment-polish/desktop-records-1440.png`
- `screenshots/TASK-20260720-004-order-detail-alignment-polish/desktop-photos-1440.png`

All screenshots use the repository mock/E2E fixture and contain no production credentials or real customer PII.

## Scope evidence

- No API, database, migration, permission, payment, workflow, or mobile-detail files changed.
- Rollback is a single task commit revert; no data rollback is required.

## Production release evidence

- Git production commit: `8dc70c7ccd87a8bde77ff113f334e288068b771b`.
- Vercel deployment: `dpl_G4X3EwapfxHPdkcnhyHEsbCt1oDK`.
- Final state: `READY`, target `production`, `aliasError: null`.
- Active aliases: `chinatech.in`, `www.chinatech.in`.
- `/orders` runtime errors during the 15-minute release window: none.
- Authenticated production smoke:
  - order-detail root width: `998px`;
  - viewport horizontal overflow: `0px`;
  - overview three-card top spread: `0px`;
  - overview three-card bottom spread: `0px`;
  - responsibility cards: `454px` each with width/top/bottom spread `0px`;
  - control row and record group: shared `920px` boundary with left/right spread `0px`;
  - key-information fields: two aligned columns of `447px`;
  - timeline: three rows, shared `920px` boundary, dialog overflow `0px`;
  - browser console warnings/errors: `0`.

Production screenshots were not persisted because the authenticated page contains customer information. The committed mock/E2E screenshots are the visual closeout evidence and contain no real customer PII.
