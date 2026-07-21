# Order preset reason workflow release

Status: application Phase 1/2 implemented; Phase 3/4 expand-only migrations validated locally and withheld from production.

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

## Data boundary

The production application release applies no database migration and performs no historical backfill.

Structured JSON is written only into an existing atomic event payload for normal transitions and approval decisions. Terminal correction/reopen/void, initial-deposit correction and non-default warranty continue to persist legacy text through their current production paths. The dedicated initial-deposit v1 RPC already exists in production; its v2 structured wrapper remains disabled.

Two additive candidates are included but must not be pushed while the migration-history gate is red:

- `20260721155031_order_reason_persistence_v2.sql`: nullable terminal/deposit snapshots, workflow-edge reason policy and explicitly named service-role-only v2 RPCs.
- `20260721155054_order_structured_facts_related_orders_v2.sql`: nullable fact projections, same-store repair episodes/relations and atomic related-order command.

Both candidates replayed successfully on an isolated RepairDesk schema snapshot. `supabase/tests/order_reason_persistence_v2.sql` passed 47/47 validator, ACL, RLS and same-store structure assertions. This is development evidence, not production-apply approval. The linked project still has material remote-only migration history and therefore remains `NO-GO` for `supabase db push`.

The following remain separate Owner-approved phases:

- production application of the two candidate migrations;
- server/UI activation of persisted fact projections and atomic related-order creation;
- workbook v3 structured round-trip and read-only operation-history sheet;
- any historical classification/backfill (the default remains null/legacy text).

## Rollout flags

All three gates must be satisfied. Any missing, `0`, `true` or malformed value is off.

```env
NEXT_PUBLIC_ORDER_PRESET_REASON_WORKFLOW_ENABLED=0
ORDER_PRESET_REASON_WORKFLOW_ENABLED=0
ORDER_PRESET_REASON_WORKFLOW_STORE_ALLOWLIST=
ORDER_REASON_PERSISTENCE_V2_ENABLED=0
```

- The public flag selects the preset UI. It is build-time and requires a redeploy when changed.
- The server master flag opens v2 commands.
- The server allowlist must contain the current actor store id exactly.
- With the UI flag off, the complete legacy free-text field remains available and API calls use legacy endpoints.
- With the UI flag on but server/store gate closed, v2 writes fail closed with `ORDER_PRESET_REASON_WORKFLOW_DISABLED`.
- `ORDER_REASON_PERSISTENCE_V2_ENABLED=1` is a second server-only gate. It must stay `0` until the Phase 3 migration is applied and verified; otherwise terminal and deposit commands continue through v1 RPCs with resolved legacy text.

Recommended canary order:

1. Deploy all flags off, including structured persistence.
2. Verify legacy transition, approval and terminal actions.
3. Enable the public and server flags for a preview deployment with one test store in the allowlist.
4. Verify stale revision, permission denial, idempotent replay and legacy text parity.
5. Enable only the Chinatech store in production and observe before adding another store.
6. Do not enable structured persistence as part of the application canary; it has a separate database change window.

## Import, export and offline compatibility

- Current workbook version remains `repairdesk-order-data-v2`; v1 and v2 are legacy-text contracts.
- The exported `定金` column is read-only. Any changed imported value is rejected with guidance to use the dedicated correction flow and choose a reason.
- Workbook v3 is not emitted until structured projections are live. It must add current selection columns and a separate read-only operation-history sheet; imported history must never overwrite events or audit evidence.
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

1. Set the public and server flags to `0` and redeploy.
2. Leave already-written event snapshots intact; do not delete or rewrite audit evidence.
3. Continue through the v1 endpoints and legacy free-text fields.
4. If a catalog revision caused an incident, publish a forward revision after fixing it; do not silently reinterpret an old code.

## Release evidence required

- lint, typecheck, full tests and production build;
- 390, 430, 768, 1024, 1280 and 1440 viewport checks;
- a soft-keyboard/visual viewport check for the `Other` note;
- confirmation that no fixed action dock overlays an open footer;
- screenshots of the enabled desktop/mobile preset flow and automated coverage of the legacy flag-off fallback;
- preview smoke before production deployment.
