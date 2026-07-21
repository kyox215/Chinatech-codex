# Order preset reason workflow completion audit

Status: **CONDITIONAL — application released; full v2 data plan not closed**

Audited source: `codex/order-preset-workflow-v2` at `497a1161` plus the audit-only
test added after that commit.

Production application: `dpl_F6nKW8p8Kz77CvFXcZF2c8yZ2hQh`, READY at
`https://www.chinatech.in`.

## Decision

The released application satisfies the no-migration compatibility scope and the
Phase 2 interaction scope. It must not yet be described as the complete Phase
3/4 rollout because the linked production migration history is still unsafe,
structured persistence is intentionally disabled, and the Phase 4 workbook and
related-order application paths are not activated.

`ORDER_REASON_PERSISTENCE_V2_ENABLED` must remain `0` until the data gate below
is approved and verified.

## Requirement-to-evidence matrix

| Plan requirement | Result | Authoritative evidence |
|---|---|---|
| Versioned, server-owned reason catalog and command-derived context | PASS | `order-reason-registry.ts`, registry/feature/contract tests |
| Action, business reason, fact, evidence channel and customer message remain distinct | PASS | reason/fact catalogs, strict schemas, message templates and release documentation |
| Cancel, unfixed pickup, mail-in, approval rejection, warranty, terminal and initial-deposit flows use preset confirmation | PASS | application components, repository adapters, 2210 unit/integration tests and browser flows |
| High-risk actions have no default reason and `Other` alone requires a note | PASS | reason-field tests, registry tests and keyboard browser check |
| Legacy text, v1 RPC and old client compatibility remain available | PASS | v1/v2 repository branches, feature flags and parity tests |
| Mobile/desktop overlay keeps CTA reachable and removes visible page dock | PASS | Chromium completion matrix, transition-scroll and visual-overflow suites |
| 360×640, 390×844, 430×932, 844×390, 768×1024, 1024×768, 1280×800, 1366×768 and 1440×900 | PASS (automated) | `visual-overflow.spec.ts`, `order-transition-scroll.spec.ts`, `order-preset-completion-matrix.spec.ts` |
| Desktop 200% zoom layout | PASS (automated approximation) | 512×384 CSS-pixel equivalent of 1024×768; not a substitute for manual browser zoom |
| Reduced motion, forced colors and keyboard radio selection | PASS (automated) | completion matrix keyboard/forced-colors test |
| WebKit scrolling, Other input and focus return | PASS (engine) | 3/3 WebKit transition-scroll tests |
| Physical iOS Safari and Android Chrome keyboard/safe-area/rotation/back gesture | MISSING | no physical-device session was available; Playwright evidence is explicitly insufficient in the plan |
| VoiceOver + Safari and NVDA + Chrome manual record | MISSING | no assisted-technology session was recorded |
| Initial deposit cannot be rewritten through generic edit/import | PASS | dedicated correction dialog, service/repository guards and import tests |
| Rework triage and disposition are separate and do not promise free warranty | PASS | catalogs, `ReworkDispositionCard` and browser evidence |
| Phase 3 additive terminal/deposit selection and v2 RPCs | PASS as candidate | `20260721155031_order_reason_persistence_v2.sql`; isolated pgTAP |
| Phase 4 structured facts, repair episodes and atomic related-order RPC | PASS as candidate schema only | `20260721155054_order_structured_facts_related_orders_v2.sql`; isolated pgTAP |
| Apply Phase 3/4 to production and enable persisted selection | BLOCKED | linked history has 19 historical statement differences; dry-run only, no production push |
| Workbook v3 structured round-trip and read-only operation history | NOT IMPLEMENTED | current workbook remains `repairdesk-order-data-v2` by documented design |
| Application reads/writes Phase 4 fact projections and creates related orders | NOT IMPLEMENTED | migration/RPC candidate exists, but no approved activation path is exposed |
| Offline stale/retired selections enter review without silent remapping | PASS for current create draft | offline schema v2 and stale-review tests; full Phase 4 round-trip waits for production projections |
| WhatsApp number validation using `libphonenumber-js/max` | NOT APPROVED | no dependency was added; current implementation may claim only weaker structural validation |
| Production application smoke and error scan | PASS | `/orders` and manifest return 200; deployment error/5xx scans were empty |

## Executed evidence

- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npx vitest run`: 339 files, 2210 tests PASS.
- `tests/e2e/order-preset-phase2.spec.ts`, `order-transition-scroll.spec.ts`
  and `visual-overflow.spec.ts`: 13/13 Chromium PASS.
- `tests/e2e/order-preset-completion-matrix.spec.ts`: 5/5 Chromium PASS.
- `tests/e2e/order-transition-scroll.spec.ts`: 3/3 WebKit PASS.
- `supabase/tests/order_reason_persistence_v2.sql`: 47/47 isolated pgTAP PASS.
- Linked Supabase migration dry run: PASS; exactly 2 candidate migrations, 0
  production writes.
- Vercel preview `dpl_55ToJj9rJoVvpUZCLzGYn523YSQC`: READY and smoked.
- Vercel production `dpl_F6nKW8p8Kz77CvFXcZF2c8yZ2hQh`: READY and aliased.

The legacy print-count assertion in `order-desktop-ui-audit.spec.ts` remains an
unrelated existing test debt and is not used as proof for this release.

## Documentation impact matrix

| Reader | Authoritative document | Sync result |
|---|---|---|
| Store staff / support | `ORDER_PRESET_REASON_WORKFLOW_RELEASE.md` | Updated with enabled compatibility behavior, feature flags and rollback |
| UI developers / QA | `UI_PAGE_GENERATION_DECLARATION.md`, `COMPONENT_GENERATION_DECLARATION.md`, `REPAIROS_MOBILE_DETAIL_STANDARD.md`, `RESPONSIVE_DENSITY_PLAN.md` | Updated with overlay, dock, focus, viewport and preset-field requirements |
| Import/export operators | `ORDER_DATA_ROUNDTRIP.md` | Correctly retains workbook v2 limits; v3 is explicitly pending |
| Lifecycle / finance maintainers | `ORDER_LIFECYCLE_CORRECTION_STANDARD.md` | Updated for dedicated initial-deposit correction and structured reason boundary |
| Release / data owners | this completion audit | Records deployment, migration dry run, unresolved history drift, approval gates and rollback |

No public documentation contains credentials, production connection strings,
customer records or message bodies. The missing workbook v3 and production data
runbook remain open deliverables rather than being documented as shipped.

## Data gate required for full completion

### Linked-history provenance audit (read-only, 2026-07-21)

- `supabase migration list --linked` from the mixed primary checkout initially
  reported 24 remote-only versions. The isolated release branch already
  contains those versions after its latest `main` reconciliation.
- `supabase migration fetch --linked --yes` was executed only in an isolated
  temporary directory. It fetched 99 remote statements and did not write to the
  repository or production database.
- Release-branch version history is now linear: all 99 remote versions are
  present locally, with only the two intended Phase 3/4 candidates
  (`20260721155031`, `20260721155054`) present locally but not remotely.
- The 24 initially missing versions all have historical Git provenance and
  match their fetched remote statements after blank-line normalization (24/24,
  0 differences, 0 missing sources).
- A whole-history comparison found 80/99 fetched statements equivalent after
  whitespace normalization and 19/99 with token-level differences. The drift
  includes the historical baseline and older order/customer/employee
  migrations, so version alignment alone is not sufficient recovery proof.
- This establishes filename/version lineage, but it does **not** prove an exact
  rebuild, current backup, restore drill, migration dry run, or permission/RLS
  behavior after application.
- No `supabase migration repair`, `supabase db push`, DDL, DML or production
  history rewrite was executed.
- `supabase db push --linked --dry-run --yes`, run against the isolated fetched
  history plus the two candidates, completed successfully and listed exactly
  `20260721155031` and `20260721155054` as the migrations that would be pushed.

The 19 historical statement differences must be reconciled as immutable
provenance or safe forward migrations; previously applied production history
must not be rewritten merely to make local files appear aligned. Production
application still requires a separate approved window with backup/restore
evidence and post-apply checks.

1. Reconcile every local/remote Supabase migration entry and prove the recovery
   baseline without rewriting production history blindly.
2. Record production table/JSONB capacity, backup and restore evidence.
3. Obtain separate Owner approval for the Phase 3 migration/RPC window and the
   Phase 4 product/data model.
4. Apply additive candidates through a dry-run-reviewed release procedure.
5. Verify RLS, grants, same-store constraints, v1/v2 parity, idempotent replay,
   and event/special-operation/audit consistency against the linked project.
6. Add and activate application reads/writes for fact projections and related
   order creation, then ship workbook v3 with a read-only operation-history
   sheet.
7. Run physical iOS/Android and screen-reader acceptance before declaring the
   entire v2 plan PASS.

## Reproduction

```bash
npm run lint
npm run typecheck
npx vitest run
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 \
  PLAYWRIGHT_REUSE_EXISTING_SERVER=1 \
  REPAIRDESK_E2E_BUSINESS_DESKTOP=1 \
  REPAIRDESK_E2E_ORDER_PRESET_COMPLETION=1 \
  NEXT_PUBLIC_ORDER_PRESET_REASON_WORKFLOW_ENABLED=1 \
  ORDER_PRESET_REASON_WORKFLOW_ENABLED=1 \
  npx playwright test --workers=1 \
  tests/e2e/order-preset-completion-matrix.spec.ts
```

## Rollback boundary

The released application remains safely reversible by disabling the public and
server preset-workflow flags and redeploying. No production schema, historical
reason, event or audit record was changed by this application release.
