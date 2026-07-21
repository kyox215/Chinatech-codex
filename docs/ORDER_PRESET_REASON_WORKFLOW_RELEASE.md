# Order preset reason workflow release

Status: application compatibility layer implemented; database expansion phases intentionally deferred.

## Outcome

This release reduces required typing in order intake, status transitions, approval rejection, warranty changes, terminal corrections, reopening and voiding. It also removes the overlap between action overlays and the page action dock.

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
- WhatsApp templates are read-only previews by default; manual editing is behind `Custom message`.
- A shared responsive action overlay with one scrolling body and a non-scrolling footer.
- `visualViewport` keyboard metrics, safe-area padding and action-dock coordination.
- Pending operations block overlay dismissal; dirty selections require discard confirmation.

## Data boundary

This release applies no database migration and performs no historical backfill.

Structured JSON is written only into an existing atomic event payload for normal transitions and approval decisions. Terminal correction/reopen/void and non-default warranty continue to persist legacy text through their current paths. Initial-deposit structured persistence remains outside this release because the required additive migration and dedicated v2 RPC have not passed the database gate.

The following remain separate Owner-approved phases:

- terminal/deposit/custody structured columns and dedicated v2 RPCs;
- workflow-edge reason policy tables;
- persisted intake, symptom, diagnosis and repair-item identities;
- repair episode, warranty claim and related-order data models;
- import/export v3 and offline structured-selection conflict resolution.

## Rollout flags

All three gates must be satisfied. Any missing, `0`, `true` or malformed value is off.

```env
NEXT_PUBLIC_ORDER_PRESET_REASON_WORKFLOW_ENABLED=0
ORDER_PRESET_REASON_WORKFLOW_ENABLED=0
ORDER_PRESET_REASON_WORKFLOW_STORE_ALLOWLIST=
```

- The public flag selects the preset UI. It is build-time and requires a redeploy when changed.
- The server master flag opens v2 commands.
- The server allowlist must contain the current actor store id exactly.
- With the UI flag off, the complete legacy free-text field remains available and API calls use legacy endpoints.
- With the UI flag on but server/store gate closed, v2 writes fail closed with `ORDER_PRESET_REASON_WORKFLOW_DISABLED`.

Recommended canary order:

1. Deploy all flags off.
2. Verify legacy transition, approval and terminal actions.
3. Enable the public and server flags for a preview deployment with one test store in the allowlist.
4. Verify stale revision, permission denial, idempotent replay and legacy text parity.
5. Enable only the Chinatech store in production and observe before adding another store.

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
