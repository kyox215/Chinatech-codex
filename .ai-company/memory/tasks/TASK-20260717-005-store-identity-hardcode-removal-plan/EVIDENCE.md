# Evidence - Store Identity Hardcode Removal Plan

| ID    | Evidence                        | Source                                                                | Finding                                                                                                             |
| ----- | ------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| E-001 | Project memory                  | `.ai-company/memory/PROJECT_MEMORY.md`                                | RepairDesk direction is independent partner stores, shared DB, strict tenant isolation, settings-based differences. |
| E-002 | Independent store plan          | `docs/INDEPENDENT_PARTNER_STORE_PLATFORM_PLAN.md`                     | Platform is not headquarters; every store is a private tenant.                                                      |
| E-003 | Progress doc                    | `docs/INDEPENDENT_PARTNER_STORE_PLATFORM_PROGRESS.md`                 | Shared database only is approved; store differences belong in settings/feature flags, not code forks.               |
| E-004 | Source scan                     | `rg --files-with-matches ... src --glob '!**/*.test.*'`               | Active source hits include login, sidebar, buyback agreement, mocks, and store identity guard.                      |
| E-005 | Runtime guard                   | `src/entities/store/model/store-output-identity.ts:84`                | Non-default stores with legacy Chinatech/Floridia identity are blocked from output.                                 |
| E-006 | Order link source               | `src/features/orders/screens/order-detail-screen.tsx:374`             | Order WhatsApp/approval URL currently uses `window.location.href`.                                                  |
| E-007 | Customer link source            | `src/features/customers/screens/customer-detail-screen.tsx:132`       | Customer message origin currently uses `window.location.origin`.                                                    |
| E-008 | WhatsApp message path           | `src/features/orders/forms/notify-dialog.tsx:82`                      | WhatsApp body is built from `orderUrl` and then opened through `wa.me`.                                             |
| E-009 | Login hardcoding                | `src/features/auth/screens/login-screen.tsx:226`                      | Login page displays Chinatech name, address, and Floridia.                                                          |
| E-010 | Buyback legal hardcoding        | `src/features/buyback/model/buyback-agreement.ts:3`                   | Buyback legal versions and text hard-code Chinatech identity.                                                       |
| E-011 | QR docs hardcoding              | `docs/SCAN_SEARCH_PAYLOADS.md:20`                                     | QR URL form still uses `https://chinatech.in/orders/{orderId}/task`.                                                |
| E-012 | Historical migration hardcoding | `supabase/migrations/20260611001527_message_templates_settings.sql:3` | Early defaults hard-code ChinaTech/Floridia; history should not be rewritten.                                       |

## Commands Run

- `git status --short`
- `rg -n "Chinatech|CHINATECH|ChinaTech|chinatech|Viale Vittorio Veneto|96014|Floridia|Siracusa|kyox120|www\\.chinatech|chinatech\\.in" ...`
- `rg --files-with-matches "Chinatech|CHINATECH|ChinaTech|chinatech|Viale Vittorio Veneto|96014|Floridia|Siracusa|kyox120@gmail|www\\.chinatech|chinatech\\.in" src ...`
- Targeted `sed` / `nl -ba` reads for the files listed above.

At the initial planning checkpoint, no tests were run because no business code had changed yet.

- `2026-07-17T19:51:40Z` `af31b53d92` — Git f44e95f0; Supabase read-only release_postcheck; Vercel dpl_GSuYh3ED8WBQVvp4n6EnyKQeNi1A; production settings browser screenshot and zero console errors.
- `2026-07-17T19:55:18Z` `a7fb977d6a` — Git origin/main@6e511c56 including f44e95f0; Supabase list aligned and dry-run up to date; read-only store identity postcheck; Vercel dpl_3sZFAFoHzvHuaS2xkVY33W7jZbjj; authenticated production settings screenshot.

## Release Validation

- `npm run lint`: passed in the isolated release worktree.
- `npm run typecheck`: passed.
- `npx vitest run --maxWorkers=4`: 208 files / 1427 tests passed for the store-identity release head.
- `npm run build`: Next.js 16.2.6 production build passed.
- Supabase: `20260717185048` and `20260717212000` are recorded; the final linked list is aligned and `supabase db push --linked --dry-run` reports the remote database is up to date.
- Production postcheck: `public_base_url` is non-null text with a validated strict URL constraint; `store_settings` RLS is enabled; all 7 rows remain empty without DML backfill; the rollback RPC remains executable only by `service_role`.
- Vercel: deployment `dpl_3sZFAFoHzvHuaS2xkVY33W7jZbjj` is `READY` / `PROMOTED` for exact `main` SHA `6e511c56`, which contains `f44e95f0`; the recent error-log query returned no errors.
- Browser: authenticated `xutech` Settings displays the editable customer portal domain and fail-closed readiness state; 1280 px viewport has no horizontal overflow and console error logs are empty.

## Documentation Impact Matrix

| Audience                | Authoritative source                                        | Release effect                                                                                                               | Verification                                                          |
| ----------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Store owner / operator  | Settings > Store and this task closeout                     | Each tenant enters its own address/contact/public URL; missing identity fields block affected customer output.               | Production `xutech` Settings smoke and screenshot.                    |
| Developer / QA          | `docs/SCAN_SEARCH_PAYLOADS.md`, `PLAN.md`, regression tests | Generic scan examples and customer-output rules are store-aware and no longer use Chinatech as a platform default.           | Commit `3615c78b`, lint/typecheck/test/build gates.                   |
| Data / release operator | Forward migrations `20260717185048` and `20260717212000`    | Adds optional tenant public URL and hardens its constraint without rewriting migration history or backfilling tenants.       | Linked migration list, final dry-run, read-only production postcheck. |
| Support                 | `CHECKPOINTS.md` and task closeout                          | Incomplete stores should be routed to Settings; this is intentional fail-closed behavior, not an inherited-address fallback. | Production readiness panel and zero runtime errors.                   |

No additional public runbook is required: the operator action is exposed directly in the existing Store Settings page. Historical migrations remain unchanged except for the replay-integrity restoration recorded in `f44e95f0`.
