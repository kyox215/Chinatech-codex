# Handoff

Current state is verified locally and not pushed.

Read first:

- `src/features/customers/components/customer-list-items.tsx`
- `src/features/customers/components/customer-profile-blocks.tsx`
- `src/features/customers/screens/customer-list-screen.tsx`

Useful commands:

- `npm run typecheck`
- `npm run lint`
- `npx vitest run src/features/customers`
- `npm run test`
- `npm run build`

Known caveat:

- In this environment, sandboxed `npm run build` can fail with a Turbopack port-binding error; non-sandbox build passed.
