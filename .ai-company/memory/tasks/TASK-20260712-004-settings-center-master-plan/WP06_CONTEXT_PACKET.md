# WP-06 Context Packet — 工单状态流

Status: local_conditional_closeout
Owner: Integration Lead
Risk / autonomy: R3 / L2 bounded local execution
Verified worktree: `/private/tmp/repairdesk-settings-center-20260712`
Verified branch baseline: `deba58f7`
Last rehydrated: 2026-07-13 CEST

## Objective

Continue the approved Settings Center plan for the order-workflow section without expanding
production authority. Replace the unsafe immediate-write editor with a store-bound draft,
reviewable change summary, responsive status editor, and fail-closed release gate.

## Verified current facts

- Workflow reads and writes derive the tenant from the authenticated actor and enforce
  `settings:update_workflow` on the server.
- The Settings page currently sends create, update, reorder, and transition mutations as soon as
  individual controls change.
- Default replacement, reorder, and transition replacement are multi-query repository operations;
  they have no shared transaction, revision/CAS, or idempotency contract.
- Workflow data has no transactional Apply endpoint or approved workflow revision source.
- Empty server workflow data is currently replaced by editable fallback rows in the Settings UI.
- Unknown/custom concrete status codes currently fall through to the canonical `closed` stage;
  transitioning an order to one can incorrectly stamp completion and delivery timestamps.

## Approved product contract

```text
server snapshot
→ store-bound local draft
→ edit statuses / order / default / transitions without network writes
→ validate and inspect a complete change summary
→ one explicit transactional Apply request
→ success accepts the returned complete version
→ conflict/failure preserves the draft and the old complete server version
```

The final Apply step is not available in the current backend and must not be emulated with the
existing sequential endpoints.

## Risk classification

| Risk                                       | Level | Control in this slice                                       |
| ------------------------------------------ | ----- | ----------------------------------------------------------- |
| Partial workflow writes                    | R3    | Settings UI sends no legacy workflow mutation while editing |
| Incorrect order closure from custom status | R3    | Fail closed before a custom target can update an order      |
| Tenant / permission escape                 | R2    | Preserve actor-derived store and server capability checks   |
| Concurrent administrator overwrite         | R3    | Detect changed snapshots locally; final CAS stays RPC-gated |
| Responsive / accessibility regression      | R2    | Dedicated component tests and six-viewport browser checks   |

## Decision and alternatives

### Selected now: local draft plus locked transactional Apply

- Safe, reversible, and does not require a database or role decision.
- Removes the current partial-write path from the Settings UI.
- Makes the missing transactional guarantee explicit to the operator.

### Rejected: orchestrate existing endpoints sequentially

- A later request can fail after earlier writes already committed.
- Client-side compensation cannot reliably restore concurrent server state or atomic audit.

### Deferred approval package: workflow revision plus transaction RPC

- Add a workflow revision source and one store-scoped, membership-verified RPC.
- Validate system invariants, active-order compatibility, default state, transition graph, and
  audit/outbox in one transaction.
- Require expected revision plus idempotency key and return the complete accepted workflow.

## Local implementation scope

- Extract the workflow section from the oversized Settings screen.
- Add pure workflow draft, validation, reconciliation, and diff helpers.
- Render explicit loading, empty, error, readonly, dirty, conflict, and apply-gated states.
- Use a single-column status list on mobile/tablet/1024, a status Sheet for editing, and a
  list-plus-transition-inspector layout at 1280+.
- Register unsaved-navigation protection and expose the workflow dirty marker in Settings nav.
- Ensure empty server data never creates editable fallback IDs.
- Add fail-closed custom-status transition protection without changing database schema.
- Add focused unit/component/server tests and Settings E2E assertions.

## Out of scope / hard stops

- No workflow RPC, schema, migration, linked database command, or production data access.
- No change to Owner/Manager/Technician/Sales/Viewer semantics.
- No decision yet on whether configured edges are mandatory or whether manual cross-edge override
  remains an elevated audited action.
- No push, deployment, feature enabling, or production release claim.

## Acceptance for this local slice

1. Editing status fields, order, default, and transitions makes zero calls to the four legacy
   workflow mutation routes.
2. The original React Query snapshot is never mutated.
3. Change review lists added, renamed, enabled/disabled, default, order, and transition changes.
4. Invalid drafts show blocking issues; Apply remains unavailable without the transaction gate.
5. Empty workflow is a safe empty state; readonly mode renders semantic values, not disabled forms.
6. Dirty drafts trigger the common leave/store-switch/history guard and can be discarded safely.
7. A custom target cannot update an order into canonical `closed` or stamp completion/delivery.
8. Workflow UI has no page-level overflow at 390, 430, 768, 1024, 1280, and 1440 widths.
9. Status Sheet closes by Escape, restores focus, leaves no pointer lock, and uses labelled controls.
10. Focused tests pass before full lint, typecheck, test, build, agents check, screenshots, and an
    independent post-write review.

## Resume / stop condition

Finish and locally commit the safe slice only after its evidence is green. Mark WP-06 conditional,
then stop at the workflow transaction/database approval gate before any Apply implementation.

## Closeout evidence

- Independent architecture, security/data, and UX/QA final reviews: P0=0/P1=0.
- Focused regression: 7 files / 98 tests; full regression: 162 files / 1052 tests.
- Responsive Playwright: 6/6 at 390, 430, 768, 1024, 1280, and 1440 widths.
- Escape closure, focus restoration, pointer-lock release, `aria-hidden`/`inert` cleanup, and
  `elementFromPoint` hit recovery pass at the required mobile and 1024px checkpoints.
- Agents check, full lint, typecheck, diff check, and final production build pass.
- No migration, linked database access, production write, push, deploy, role change, or retention
  decision occurred.
