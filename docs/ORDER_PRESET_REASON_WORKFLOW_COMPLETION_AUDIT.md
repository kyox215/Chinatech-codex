# Order preset reason workflow completion audit

Status: **PRODUCTION COMPLETE — Phase 3/4 active for ChinaTech**

Audited source: `codex/order-preset-workflow-v2` at application commit
`8aa73281` (closeout documentation may be newer).

Production application: `dpl_9t5bqcUejKML8txztxeTHCNS1YFT`, READY at
`https://www.chinatech.in` and `https://chinatech.in`.

Production database: Supabase project `xluzcoduqsdvjoouqhkc`; migrations
`20260721155031` and `20260721155054` are applied and recorded.

## Decision

The Owner-approved Phase 3/4 scope is released. Structured intake, reported-fault
and diagnostic selections, immutable-source related rework orders, structured
disposition, and workbook v3 import/export are active for the ChinaTech store.
Legacy workbook v1/v2 reads and v1 API behavior remain compatible.

The completed source order remains immutable. Starting after-sales reinspection
creates a separate zero-finance child through a dedicated, idempotent,
service-role-only RPC. The child records the episode/relation; it never rewrites
the completed source into a rework state.

## Requirement-to-evidence matrix

| Requirement | Result | Authoritative evidence |
|---|---|---|
| Preset reasons and structured facts replace routine free typing | PASS | versioned catalogs, strict command schemas, application components and 2,218 passing Vitest tests |
| CTA remains reachable without bottom-dock overlap | PASS | responsive overlays, focused Phase 4 Playwright contract and screenshot |
| Structured reason persistence | PASS — production | `20260721155031_order_reason_persistence_v2.sql`; production ACL/constraint post-check |
| Structured facts, episodes and related-order creation | PASS — production | `20260721155054_order_structured_facts_related_orders_v2.sql`; production RLS/RPC/column post-check |
| Original completed order remains unchanged | PASS | dedicated related-order RPC contract and 15/15 restored-snapshot runtime tests |
| Workbook v3 structured round-trip and read-only history | PASS — production | v3 export/import implementation and 6/6 restored-snapshot apply/rollback tests |
| Workbook v1/v2 compatibility | PASS | normalizers, compatibility tests and independent v3 flags |
| Initial deposit cannot be rewritten through generic edit/import | PASS | dedicated correction workflow, service/repository guards and import tests |
| High-risk commands have no unsafe default; `Other` requires a note | PASS | catalog, field and keyboard contract tests |
| RLS, direct-DML revocation and service-only RPC boundary | PASS — production | post-apply catalog/ACL checks; 4 new tables RLS-enabled and 5 Phase 4 RPCs service-only |
| Store-scoped rollout and fail-closed apply | PASS | exact ChinaTech allowlists, including `ORDER_DATA_APPLY_STORE_ALLOWLIST` |
| Production application and error scan | PASS | final deployment READY, `/login` HTTP 200, recent error log scan empty |
| Physical iOS/Android and VoiceOver/NVDA manual record | NOT RECORDED | automated Chromium/WebKit, viewport and keyboard coverage exists; no physical-device or assistive-technology session was available |

## Executed evidence

- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npx vitest run`: 340 files, 2,218 tests PASS.
- `npm run build`: PASS with the production build.
- `tests/e2e/order-related-workflow-phase4.spec.ts`: PASS; the dialog has no
  text box, its preset selection enables `建立复检单`, and there is no horizontal
  overflow or dock obstruction.
- Restored production snapshot: Phase 3 pgTAP 53/53 PASS; related rework runtime
  15/15 PASS; workbook v3 apply/rollback 6/6 PASS.
- Final linked migration dry-run after apply: `Remote database is up to date`.
- Production database observation: 6,376 orders; 0 new episode, relation,
  related-operation or disposition-operation rows from the release procedure.
- Production deployment `dpl_9t5bqcUejKML8txztxeTHCNS1YFT`: READY; both
  production aliases active; `/login` 200; 15-minute error scan empty.

The migration/release procedure intentionally created no business order, child
order, workbook apply operation or disposition record in production. The order
count increased from the earlier 6,373 baseline to 6,376 before the Phase 3
post-check; neither additive migration writes `repair_orders`, so these are
concurrent store activity and were not modified by this release.

## Recovery evidence

Fresh pre-change logical backups were created with owner-only file permissions
and successfully restored into an isolated PostgreSQL 17 database before the
production window:

- schema: `/private/tmp/repairdesk-pre-phase34-20260721-schema.sql`
  (`edf62e9eed645863c23e7fb3dd39091ede476ba8e12ba29c25ca0dba71caf8af`)
- public data: `/private/tmp/repairdesk-pre-phase34-20260721-public-data.sql`
  (`1557f1f527261a4c67e4805b6dbbc969b26f70a5f36ceca000d9da234cefae8d`)

The initial broader dump containing internal/auth schemas was deleted after the
public-only backup succeeded. No credentials or customer payloads are included
in this audit.

## Production feature boundary

The client/server structured workflows, related-order commands and workbook v3
are enabled only for store `5248dda1-2b32-46cd-8ed0-d15386a9e8ed` where a store
allowlist applies. Workbook apply is additionally guarded by
`ORDER_DATA_APPLY_STORE_ALLOWLIST`; enabling its global switch therefore does
not expose legacy v1/v2 apply to other stores. Workbook export remains
owner-only.

Rollback is non-destructive and staged: disable the public/server workflow,
related-order, v3 import and data-apply flags, then redeploy. The additive
columns/tables and old API paths may remain in place. Schema rollback should be
considered only for a confirmed database incident because removing additive
objects would be more destructive than flag rollback.

## Residual evidence gap

No authenticated in-app-browser production session was available for a live
business-write smoke test, and the release intentionally did not create test
orders in production. The final UI evidence is therefore a deterministic local
Playwright flow backed by live production migration/ACL/HTTP/log observations
and restored-snapshot transactional tests. Physical-device and screen-reader
acceptance remain follow-up QA evidence, not an undisclosed production blocker.

Visual evidence:
`/private/tmp/repairdesk-phase4-screens/desktop-related-rework-triage-1280x800.png`.
