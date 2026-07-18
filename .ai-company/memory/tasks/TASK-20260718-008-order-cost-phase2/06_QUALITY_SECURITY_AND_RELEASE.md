# Stage 06 — Quality, Security and Release Readiness

Status: completed — 2026-07-18T14:36:02Z

## Goal

Prove acceptance, repair independent findings, synchronize documentation and produce an executable release packet.

## Validation matrix

- `npm run agents:check`
- `npm run lint`
- `npm run typecheck`
- Targeted Phase 2 Vitest suites
- Full `npm run test`
- `npm run build`
- Local migration replay/schema-clone tests and SQL behavior transactions
- Permission, RLS, ACL, RPC, tenant, audit and forbidden-field scans
- Browser E2E for Profit Center, order cost source, parts purchase, export and backfill preview
- Viewports: 390×844, 430×932, 768×1024, 1024×768, 1280×800, 1440×900
- Relevant screenshots without secrets or customer PII

## Exit criteria

- Independent Architecture/Data/Security/QA reviews have no unresolved BLOCKER or MAJOR.
- Documentation, runbook, rollback and feature-flag contracts match code.
- Release candidate diff contains only TASK-008 files.
- A pre-release checkpoint records exact commit and migration candidates.

## Release-candidate correction

The data-migration review found that the first three Phase 2 filenames were earlier than the
already-applied Phase 1 migrations (`20260718120000` and `20260718121000`). Shipping them under
their original names would require inserting history before the current remote head and could
tempt an unsafe `--include-all` bypass. Before candidate freeze they were reissued, without
economic behavior changes, as:

- `20260718122000_order_cost_phase2_ledger_permissions.sql`
- `20260718123000_order_cost_phase2_profit_reports.sql`
- `20260718124000_order_cost_phase2_parts_procurement.sql`

The later export, backfill and currency migrations remain `20260718130000`, `20260718133000` and
`20260718140000`. The six-file sequence is now strictly after Phase 1 and strictly increasing.

## Review result

| Review | Result | Evidence / residual boundary |
|---|---|---|
| Architecture | PASS | Thin `/finance` route, feature-owned UI/server code, server aggregation and additive private schema; no dependency or global currency contract change. |
| Data migration | PASS for TASK-008 candidate; production gate still NO-GO | Two new PostgreSQL 17 databases passed the reissued ledger fixture and the complete Stage 01–05 chain. The repository-wide historical replay blocker predates TASK-008 and remains a Stage 07 stop condition. |
| Security | PASS for TASK-008 slice | All 11 Phase 2 tables have RLS, browser CRUD is false and service-role read is explicit. All Phase 2 callable RPCs deny anon/authenticated and use `search_path=''`; permissions, tenant denial, forbidden DTO fields, CSV injection and audit minimization are covered. Existing Phase 1 helper/browser grants and the broader 17-table legacy exposure are not reclassified as fixed. |
| QA | PASS | Agent rules, lint, TypeScript, 259 test files / 1669 tests and the webpack production build passed. Cumulative browser evidence covers all six required widths and each Phase 2 flow with synthetic PII-free data. |
| UX/accessibility | PASS | Unauthorized controls remain unmounted, empty/unknown/estimated states are explicit, destructive backfill requires Owner confirmation and relevant inputs have accessible labels. |
| Documentation/release | PASS for candidate packet; production gate still NO-GO | `docs/ORDER_INTERNAL_COSTS.md`, `.env.example`, rollback, flags, six migrations and stop conditions match code. |

Review execution note: Stage 00 already received three real read-only department reviews. No new
Stage 06 sub-agent was spawned because the active orchestration policy prohibits spawning unless
the user explicitly requests delegation. The Integration Lead therefore performed separate
architecture, data, security, QA, UX and release passes in the main thread; this is not reported
as additional independent Agent usage.

## Verification result

- Rebased successfully onto current `origin/main@51d5b3b9`; candidate lineage is six commits ahead
  and zero behind before the Stage 06 closure commit.
- Disposable PostgreSQL 17:
  - `repairdesk_cost_phase2_rc_ledger_20260718_d` ended with
    `order_cost_phase2_minimal_harness_passed`.
  - `repairdesk_cost_phase2_rc_full_20260718_d` ended with profit, parts, export, backfill and
    multi-currency harnesses all passed.
- Live catalog checks inside the disposable candidate database found 11/11 Phase 2 tables with
  RLS enabled, zero anon/authenticated CRUD privilege and explicit service-role read privilege.
- Phase 2 RPC catalog checks found zero anon/authenticated execute privilege and
  `search_path=''`; precise service-role RPC grants remained present.
- `npm run agents:check`, `npm run lint`, `npm run typecheck`, full `npm run test`, and
  `git diff --check` passed. Full test result: 259 files / 1669 tests.
- `npx next build --webpack` passed and generated 25 application pages including `/finance`.
  Default `npm run build` reached only the known isolated-worktree Turbopack limitation: the
  linked `node_modules` directory points outside the temporary filesystem root. This is not an
  application compile failure and does not exist in the normal checkout/deployment environment.
- Existing PII-free screenshots cover Profit Center at 390/1440, the six-width responsive run,
  parts settings/allocation at desktop/mobile, supplier breakdown, authorized/hidden export,
  backfill preview/confirmation and multi-currency settings/procurement preview.

## Release packet and stop conditions

- Exact candidate migrations are the six files listed in `docs/ORDER_INTERNAL_COSTS.md`; no
  historical backfill run is authorized or automated.
- All Phase 2 child flags remain `0` through migration apply and first application deploy.
- Rollback is child-flag off, then parent-flag off/application rollback; preserve additive
  financial evidence and use reviewed forward fixes for schema issues.
- Stage 07 may perform read-only linked preflight. It must not apply migrations, push `main` or
  deploy this schema-dependent candidate while the historical recovery baseline, 17 legacy
  browser-role exposures, PITR/isolated restore proof or serialized release evidence remain open.

Stage 06 exit criteria are satisfied for the local release candidate. This does not change the
production Database Application Gate from NO-GO.
