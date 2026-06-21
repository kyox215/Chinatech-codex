# Evidence

## Changed Files

- `src/shared/config/navigation.ts`
- `src/shared/lib/shell-actions.ts`
- `src/components/app-sidebar.tsx`
- `src/components/app-bar.tsx`
- `src/components/mobile-workspace-dock.tsx`
- `src/components/command-palette.tsx`

## Visual Evidence

- `screenshots/shell-unification-20260621/customers-desktop-shell.png`
- `screenshots/shell-unification-20260621/buyback-mobile-quick-sheet.png`
- `screenshots/shell-unification-20260621/orders-desktop-shell-unified.png`
- `screenshots/shell-unification-20260621/buyback-mobile-quick-sheet-viewport.png`
- `screenshots/shell-unification-20260621/buyback-mobile-quick-sheet-dialog.png`

## Verification

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run test`: 39 files passed, 235 tests passed.
- `npm run build`: passed outside sandbox; sandbox build hits known Turbopack internal port-binding restriction.
- `REPAIRDESK_E2E_BUSINESS_DESKTOP=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 PLAYWRIGHT_WEBSERVER_COMMAND='echo using-existing-server' npx playwright test tests/e2e/app-shell.spec.ts`: 2 passed.
- `node` + Playwright direct shell assertions against `http://127.0.0.1:3017`: passed after sandbox browser permission was escalated.
  - Desktop `/orders` top bar and sidebar header heights align within 1px.
  - Mobile `/buyback` has exactly one global quick trigger.
  - Mobile workspace route hides the global AppBar.
  - Mobile quick sheet renders current-module action plus scan, camera, messages, and global search.

## Notes

E2E auth bypass was used only for local visual verification and mock data screenshots. No real credentials, customer PII, or production session data were used.
