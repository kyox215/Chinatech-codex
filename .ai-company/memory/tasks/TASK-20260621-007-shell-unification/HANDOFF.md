# Handoff

Current state is verified locally and not pushed.

Read first:

- `src/shared/config/navigation.ts`
- `src/shared/lib/shell-actions.ts`
- `src/components/app-bar.tsx`
- `src/components/mobile-workspace-dock.tsx`
- `tests/e2e/app-shell.spec.ts`

Useful commands:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `REPAIRDESK_E2E_BUSINESS_DESKTOP=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 PLAYWRIGHT_WEBSERVER_COMMAND='echo using-existing-server' npx playwright test tests/e2e/app-shell.spec.ts`

Known caveat:

- In this environment, sandboxed `npm run build` can fail with a Turbopack port-binding error; non-sandbox build passed.
