# Handoff

## Resume Packet

Task: `TASK-20260709-017-global-scan-search-plan`

Current state: implementation in isolated worktree, validation in progress.

Worktree: `/private/tmp/repairdesk-global-scan-search`

Primary files:

- `src/features/capture/model/scan-search-resolver.ts`
- `src/features/capture/components/scan-search-button.tsx`
- `src/shared/ui/repair-os-mobile.tsx`
- `src/features/orders/components/order-list-mobile-header.tsx`
- `src/features/orders/screens/order-list-screen.tsx`
- `src/features/customers/screens/customer-list-screen.tsx`
- `src/features/buyback/screens/buyback-screen.tsx`
- `src/features/inventory/screens/inventory-screen.tsx`
- `src/app/providers.tsx`
- `src/components/app-bar.tsx`
- `src/components/command-palette.tsx`
- `src/components/mobile-workspace-dock.tsx`
- `docs/SCAN_SEARCH_PAYLOADS.md`

Next actions:

1. Run full `npm run test`.
2. Run `npm run build`.
3. Start local server and capture relevant screenshots if possible.
4. Commit and push main.

Database status:

- No migration required.
- Do not run broad linked Supabase push for this task.
