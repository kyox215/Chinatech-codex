# Order preset reason workflow release

Status: Phase 1/2 application flow shipped; Phase 3/4 product, API, migration and workbook v3 implementation validated and approved for the controlled ChinaTech production rollout.

## Outcome

This release reduces required typing in order intake, diagnosis, status transitions, approval rejection, warranty changes, initial-deposit correction, terminal corrections, reopening, voiding and rework review. It also removes the overlap between action overlays and the page action dock.

The application keeps the existing human-readable reason fields for old clients, printing and timeline rendering. New v2 commands submit stable codes; the server resolves those codes to legacy text and rejects stale revisions.

## Delivered application scope

- A versioned, server-authoritative order reason registry.
- No preselected reason for cancel, rejection, reopen, correction or void actions.
- Preset radio choices with an `Other` path that alone opens a required note field.
- Stable `schema_version`, `primary_code`, `catalog_revision` and normalized note input.
- Strict v2 schemas for transition, approval and terminal commands.
- Actor/store/order-scoped catalog endpoint: `GET /api/repairdesk/order/reason-catalog`.
- Existing atomic transition and approval events double-write legacy text and a structured internal snapshot.
- Terminal operations resolve selections to existing legacy RPC text without claiming structured terminal persistence.
- Non-default warranty choices use preset reasons while retaining the legacy reason field.
- Intake intent choices: known problem, pending diagnosis, customer cannot describe, and diagnostic only.
- Separate multi-select catalogs for customer-reported symptoms and technician findings; repair/quote items remain a third identity.
- A dedicated initial-deposit correction dialog with money keypad, preset reason and capability-based blocking after approval or payment evidence.
- Generic order edit, finance patch and workbook import cannot rewrite the initial deposit.
- Rework triage and post-diagnosis disposition are separate; triage never promises free warranty and the compatibility phase never claims a related order was created.
- Offline create drafts persist schema version and fact catalog revision; stale or retired choices are preserved and sent to review rather than silently remapped.
- WhatsApp templates are read-only previews by default; manual editing is behind `Custom message`.
- A shared responsive action overlay with one scrolling body and a non-scrolling footer.
- `visualViewport` keyboard metrics, safe-area padding and action-dock coordination.
- Pending operations block overlay dismissal; dirty selections require discard confirmation.

## Phase 3/4 data boundary

The approved release applies two expand-only migrations and performs no historical classification or backfill. Existing legacy text remains authoritative for historical rows; new structured columns stay nullable.

The two production migrations are:

- `20260721155031_order_reason_persistence_v2.sql`: nullable terminal/deposit snapshots, workflow-edge reason policy and explicitly named service-role-only v2 RPCs.
- `20260721155054_order_structured_facts_related_orders_v2.sql`: nullable fact projections, same-store repair episodes/relations and atomic related-order command.

Before production apply, the exact production schema and public data were dumped and restored into an isolated PostgreSQL 17 database. Both migrations replayed on that restored snapshot. Contract, related-order runtime and workbook v3 apply/rollback pgTAP suites passed. The linked dry-run resolved to exactly these two pending versions; historical statement-token differences are recorded but are not rewritten.

The approved runtime contract is:

- completed source orders are immutable during after-sales intake;
- starting after-sales review creates an independent zero-finance rework child, relation and episode in one transaction;
- disposition requires a saved diagnosis and updates the server-owned relation type without trusting client identity/status/finance fields;
- terminal/deposit structured snapshots store catalog identity and note presence without copying the private note body into audit metadata;
- workbook v3 writes structured selections atomically and rolls them back atomically; its operation-history sheet is read-only and never stages event payloads;
- historical rows are not reverse-classified and there is no production backfill in this release.

## Rollout flags

Every gate is exact-value and fail-closed. Any missing, `0`, `true` or malformed value is off. Server features also require the current store id in the matching allowlist.

```env
NEXT_PUBLIC_ORDER_PRESET_REASON_WORKFLOW_ENABLED=0
ORDER_PRESET_REASON_WORKFLOW_ENABLED=0
ORDER_PRESET_REASON_WORKFLOW_STORE_ALLOWLIST=
ORDER_REASON_PERSISTENCE_V2_ENABLED=0
NEXT_PUBLIC_ORDER_STRUCTURED_FACTS_V2_ENABLED=0
ORDER_STRUCTURED_FACTS_V2_ENABLED=0
ORDER_STRUCTURED_FACTS_V2_STORE_ALLOWLIST=
ORDER_RELATED_ORDER_V2_ENABLED=0
ORDER_RELATED_ORDER_V2_STORE_ALLOWLIST=
ORDER_DATA_WORKBOOK_V3_EXPORT_ENABLED=0
ORDER_DATA_WORKBOOK_V3_IMPORT_ENABLED=0
ORDER_DATA_WORKBOOK_V3_STORE_ALLOWLIST=
ORDER_DATA_APPLY_STORE_ALLOWLIST=
```

- The public flag selects the preset UI. It is build-time and requires a redeploy when changed.
- The server master flag opens v2 commands.
- The server allowlist must contain the current actor store id exactly.
- With the UI flag off, the complete legacy free-text field remains available and API calls use legacy endpoints.
- With the UI flag on but server/store gate closed, v2 writes fail closed with `ORDER_PRESET_REASON_WORKFLOW_DISABLED`.
- `ORDER_REASON_PERSISTENCE_V2_ENABLED=1` is a second server-only gate. It must stay `0` until the Phase 3 migration is applied and verified; otherwise terminal and deposit commands continue through v1 RPCs with resolved legacy text.
- `NEXT_PUBLIC_ORDER_STRUCTURED_FACTS_V2_ENABLED=1` blocks offline create so a structured selection cannot be silently downgraded; it is build-time and requires redeploy.
- Structured facts, related orders, workbook export and workbook import have separate server flags so each surface can be paused without dropping schema objects.
- Workbook v3 import is enabled only after v3 export/download and preview validation pass for the ChinaTech canary.
- Import apply additionally requires `ORDER_DATA_APPLY_ENABLED=1` and the store id in `ORDER_DATA_APPLY_STORE_ALLOWLIST`; the global apply flag alone never opens another store.

Recommended canary order:

1. Deploy the Phase 3/4 application artifact with all new flags off and verify the legacy health path.
2. Apply `20260721155031`, verify its columns, RPCs, ACLs and unchanged row counts.
3. Apply `20260721155054`, verify its tables, RLS, grants, RPCs and unchanged source-order counts.
4. Enable preset reasons, reason persistence, structured facts and related orders only for ChinaTech.
5. Enable workbook v3 export for ChinaTech and verify export plus read-only history.
6. Enable workbook v3 import for ChinaTech only after preview/apply/rollback smoke; observe errors before any additional store.

## Import, export and offline compatibility

- `repairdesk-order-data-v3` is the latest contract; v1 and v2 remain accepted legacy-text contracts.
- The exported `定金` column is read-only. Any changed imported value is rejected with guidance to use the dedicated correction flow and choose a reason.
- Workbook v3 adds code/revision groups for intake intent, reported symptoms and diagnostic findings, stable repair-line identity, and a separate read-only operation-history sheet. Imported history never overwrites events or audit evidence.
- A partial v3 structured group, stale catalog revision or unknown code is rejected rather than guessed.
- A v1/v2 text edit that would drift from an existing structured selection is rejected with guidance to use v3.
- Legacy text is never reverse-guessed into a code.
- Offline draft schema v2 stores customer-symptom codes and catalog revision locally. A stale revision marks the draft/outbox as review-required and blocks automatic sync.

## Catalog contract

The client requests an action, not a trusted context. The server derives context from the command, target status, current order status and projected capabilities.

Supported catalog actions:

- `transition` with target `cancelled`, `unfixed_pickup`, `mail_in_progress` or `rework`;
- `approval_reject`;
- `initial_deposit_correction`;
- `warranty` with from/to months;
- `terminal_correct`, `terminal_reopen`, `terminal_void`.

The catalog response exposes staff labels and note requirements but not server legacy text. A store-scoped order read occurs before a catalog is returned. Rework is limited to a completed or cancelled source order.

## Compatibility and privacy

- Internal notes are not used as customer WhatsApp or print content.
- The stored internal snapshot contains `zh-CN` labels and text for staff history only.
- No public snapshot is generated for internal operational reasons.
- Audit metadata records code, revision and note presence, not the free note body.
- Existing v1 endpoints and existing legacy text remain available during the observation period.

## UI safety contract

- Mobile uses a bottom sheet; desktop uses a dialog at 1024px and above.
- Header and footer never share the body scroll container.
- The footer includes safe-area padding and follows the real visual viewport when the soft keyboard opens.
- The underlying desktop or mobile action dock is unmounted while an action overlay, timeline, camera, preview or status sheet is open.
- Touch choices are at least 44px high and selection is conveyed by radio state, checkmark and text, not color alone.
- High-risk actions start without a default reason.

## Rollback

1. Set the related-order and workbook import flags to `0` first; if needed set all Phase 3/4 public and server flags to `0` and redeploy.
2. Leave already-written event snapshots intact; do not delete or rewrite audit evidence.
3. Continue through the v1 endpoints and legacy free-text fields.
4. If a catalog revision caused an incident, publish a forward revision after fixing it; do not silently reinterpret an old code.
5. Leave additive schema, relations, episodes and audit evidence in place. Do not drop tables or rewrite history as an application rollback.

## Release evidence required

- lint, typecheck, full tests and production build;
- 390, 430, 768, 1024, 1280 and 1440 viewport checks;
- a soft-keyboard/visual viewport check for the `Other` note;
- confirmation that no fixed action dock overlays an open footer;
- screenshots of the enabled desktop/mobile preset flow and automated coverage of the legacy flag-off fallback;
- preview smoke before production deployment.
