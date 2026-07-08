# RepairDesk Runbook

Last verified: 2026-06-20 CEST
Scope: running and validating the current project. No secrets are included.

## 1. Runtime Requirements

From `package.json`:

- Node.js: `>=22.12.0`
- Package manager: npm is used by existing scripts.
- Next.js: `16.2.6`
- React: `19.2.0`
- TypeScript: `5.8.3`
- Supabase JS: `2.105.4`
- Supabase SSR: `0.10.3`
- React Query: `5.83.0`
- Vitest + Playwright are configured for tests.

## 2. Install

```bash
npm install
```

The repository currently has `node_modules` locally, but a clean environment should install from `package-lock.json` if present or the current package metadata.

## 3. Environment Variables

Use `.env.example` as the safe shape reference. Do not copy real secrets into docs or prompts.

Required variable names:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Rules:

- `SUPABASE_SERVICE_ROLE_KEY` is server-only.
- `NEXT_PUBLIC_*` values are exposed to browser code.
- Do not log secrets.
- Do not put real secrets in migrations, docs, tests, screenshots, or prompts.
- This export did not read `.env.local`.

## 4. Supabase Local Configuration

From `supabase/config.toml`:

- Project id: `xluzcoduqsdvjoouqhkc`
- Local API port: `54321`
- Local DB port: `54322`
- Local Studio port: `54323`
- Auth site URL: `http://127.0.0.1:3000`
- Auth signup: enabled
- JWT expiry: 3600 seconds
- Storage: enabled

Useful Supabase commands depend on the developer machine setup and Supabase CLI login state. For refactor work, do not push migrations or reset production without explicit owner approval.

## 5. Development Server

```bash
npm run dev
```

Script:

```bash
WATCHPACK_POLLING=true CHOKIDAR_USEPOLLING=1 next dev
```

Default local URL:

```txt
http://localhost:3000
```

Common login-gated route:

```txt
http://localhost:3000/orders
```

If not logged in, protected routes may redirect to:

```txt
/login?next=<encoded route>
```

## 6. Production Build And Preview

```bash
npm run build
npm run preview
```

Scripts:

```bash
next build
next start
```

## 7. Validation Commands

Core gates:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Combined gate:

```bash
npm run check
```

`npm run check` currently expands to:

```bash
npm run agents:check && npm run lint && npm run typecheck && npm run test && npm run build
```

E2E:

```bash
npm run test:e2e
```

Desktop business E2E helper:

```bash
npm run test:e2e:desktop
```

Storybook:

```bash
npm run storybook
npm run build-storybook
```

Repository hygiene and governance checks:

```bash
npm run agents:config
npm run agents:templates
npm run agents:check
```

## 8. Database And Data Scripts

Available scripts:

```bash
npm run db:seed
npm run db:reset-demo
npm run db:ensure-owner-admin
npm run db:import:seatable
```

Admin bootstrap pattern:

```bash
ADMIN_EMAIL=<email> ADMIN_PASSWORD=<password> ADMIN_DISPLAY_NAME=<name> npm run db:ensure-owner-admin
```

Rules:

- Use one-time environment variables for sensitive admin password values.
- Do not hard-code passwords or service keys.
- Do not run destructive data reset against production.
- Do not run migration or data-change commands without confirming target environment.

## 9. Main Routes To Smoke Test

Protected/business routes:

- `/`
- `/orders`
- `/orders/new`
- `/orders/[id]`
- `/orders/[id]/task`
- `/customers`
- `/customers/[id]`
- `/inventory`
- `/buyback`
- `/messages`
- `/settings`
- `/platform`
- `/onboarding`

Public/support routes:

- `/login`
- `/offline`

API route:

- `/api/repairdesk/[...path]`

## 10. Common Refactor Verification Strategy

Before refactoring:

1. Run `npm run typecheck`.
2. Run focused tests for the module being touched.
3. Save current behavior notes from `SYSTEM_FUNCTIONAL_MAP.md`.

During refactor:

1. Keep API facade signatures stable.
2. Keep Zod schema body shapes stable.
3. Keep store isolation server-side.
4. Keep client components away from `src/server/*`.
5. Keep migrations separate from frontend refactors.

After refactor:

1. Run focused tests.
2. Run `npm run lint`.
3. Run `npm run typecheck`.
4. Run `npm run test`.
5. Run `npm run build`.
6. Run E2E only when page/workflow behavior changed or before release.

## 11. Troubleshooting Notes

- Bracketed App Router paths such as `src/app/orders/[id]/page.tsx` must be quoted in shell commands.
- The checkout can be dirty; do not revert unrelated user changes.
- Some historical docs are marked snapshots and may be outdated.
- The current route layer is `src/app`; `src/routes` is legacy compatibility and should not be used for new route work.
- Localhost browser automation may be blocked in some environments; use command-level verification when browser access fails.
