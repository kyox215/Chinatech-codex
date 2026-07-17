# Order Detail Edit Save Flow

Status: implemented and locally verified; cross-shell close guard remains a tracked follow-up
Owner: Product Workflow + Frontend + QA / Integration Lead
Scope: desktop order-detail edit session, ordinary fields, quote fields, retry and conflict behavior
Last reviewed: 2026-07-17 CEST by `TASK-20260717-order-detail-save-orchestration`

## 1. Business outcome

The order-detail `保存` action represents the current edit session, not one hidden subsection. A user may change ordinary order information and quote information before pressing save once. The client must create one deterministic save plan, preserve server authorization and optimistic locking, and make partial success visible and retryable.

The current APIs remain separate:

- ordinary fields: `patchOrder` / `order/patch`;
- quote fields: `patchOrderFinance` / `order/finance`.

Both return a new `updated_at`. The client must never run these requests in parallel and must never reuse the original version for the second request.

## 2. Edit-session invariants

1. Editing starts with an immutable baseline snapshot and its `expected_updated_at`.
2. Background query refreshes may update the displayed server record, but they do not silently replace the edit baseline.
3. A save click creates one immutable plan from the baseline and the current draft.
4. Only changed sections are validated and submitted.
5. The amount draft keeps string semantics until normalization; an empty amount is not converted to `0`.
6. Server permission, store scope, field validation and optimistic locking remain authoritative.
7. One edit session has at most one active save chain.
8. The local offline draft is cleared only after every planned step is confirmed successful.

## 3. Save plan and ordering

The plan contains zero, one or two ordered steps:

```text
clean                  → []
ordinary dirty         → [routine]
quote dirty            → [finance]
ordinary + quote dirty → [routine, finance]
```

The combined order is always:

```text
patchOrder(base updated_at)
  → routine result.updated_at
  → patchOrderFinance(routine result.updated_at)
```

Ordinary information goes first because quote persistence has the larger workflow side effect: it recalculates finance fields and may reset a previous quote approval. If the ordinary request fails, the quote request is not sent.

## 4. State machine

```text
clean
  → dirty
  → validating
  → saving_routine?
  → saving_finance?
  → success

validation error
  → dirty

first request failure
  → failed_none
  → dirty

routine success + finance failure
  → partial_success
  → finance_dirty
  → retry_finance

optimistic conflict or ambiguous response
  → reconcile_required
  → manual review before a new edit baseline
```

## 5. Required behavior by scenario

| Scenario                                      | Requests                                       | Draft and feedback                                                          |
| --------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| No changes                                    | None                                           | Save is disabled; no error toast.                                           |
| Ordinary only                                 | `patchOrder(v0)`                               | Exit edit after success and clear the local draft.                          |
| Quote only                                    | `patchOrderFinance(v0)`                        | Exit edit after success and clear the local draft.                          |
| Both sections                                 | `patchOrder(v0)`, then `patchOrderFinance(v1)` | Show one overall success only after both steps finish.                      |
| Client validation error                       | None                                           | Keep every draft value and show the relevant validation error.              |
| Ordinary request fails                        | Finance is not called                          | Keep ordinary and quote drafts; do not auto-retry.                          |
| Quote request fails after ordinary success    | Routine stays saved                            | Advance the local baseline to `v1`; keep only quote work retryable.         |
| Duplicate click                               | One chain only                                 | Ignore later clicks while the chain is active.                              |
| Version conflict                              | Stop the chain                                 | Keep the draft and require a new review; never auto-merge or overwrite.     |
| Timeline/audit or network result is ambiguous | Stop and refresh for reconciliation            | Do not claim that the data is definitely unsaved and do not blindly replay. |

## 6. Partial-success recovery

The two existing endpoints are not one transaction. A client-side compensating rollback is forbidden because it would create another version, another audit event and another opportunity for conflict.

After ordinary information is confirmed and quote saving fails:

1. keep the edit screen open;
2. apply the successful routine changes to the local baseline;
3. replace the baseline version with the routine response `updated_at`;
4. retain the quote draft and its validation state;
5. update the local offline draft to the new baseline version;
6. invalidate order read caches;
7. on retry, generate a new plan that contains only `finance`.

If a request may have persisted data before returning an error, a later compare/reconcile enhancement must classify the server value as:

- equal to target: persisted with warning;
- equal to old baseline: still dirty and retryable;
- different from both: conflict requiring manual review.

Until that reconciliation UI exists, compare-and-swap prevents a blind duplicate update, and the error message must tell the user to refresh and verify.

## 7. Validation scope

- An unchanged legacy quote placeholder must not block an ordinary-field save.
- An unchanged incomplete ordinary field must not block a quote-only save.
- A changed ordinary required field is validated before `patchOrder`.
- A changed quote is normalized and validated before either request begins in a combined plan; combined saving does not intentionally create a preventable partial success.
- A user without finance permission cannot produce a finance step.

## 8. Local draft and close behavior

The local edit draft must include a valid normalized quote projection as well as ordinary fields. On partial success, its `baseUpdatedAt` advances to the last confirmed server version. Sensitive unlock values continue to follow the existing offline-secret restrictions.

The following close protection is the complete target flow and remains a separate integration slice because it crosses the page, the order-list dialog shell and mobile quote editor:

- dirty `取消`, dialog close, Escape, backdrop click, browser back and route navigation must offer `继续编辑 / 放弃修改`;
- a save chain in progress cannot be closed;
- partial success discards only remaining local work, never the already-persisted routine step;
- mobile quote `收起` and `取消` must not silently clear a dirty quote.

The core save-orchestration patch does not claim this cross-shell close guard is complete. It is a release-readiness follow-up, not permission to reintroduce the old split-save blocker.

## 9. Test contract

At minimum, automated tests must cover:

- clean, ordinary-only, quote-only and combined plans;
- exact request order and `updated_at` handoff;
- first-step stop behavior;
- second-step partial-success metadata;
- a retry plan containing only the remaining finance step;
- finance permission denial;
- unchanged invalid legacy quote not blocking an ordinary save;
- duplicate-click single flight at the screen boundary;
- optimistic conflict without automatic replay;
- local-draft baseline advancement after partial success.

Browser verification uses a synthetic or redacted order and covers the desktop order dialog at `1280×800` plus the order page at `390×844` / `430×932`. The page must not overflow horizontally, and screenshots must not include customer PII or credentials.

## 10. Architecture decision, upgrade and rollback

Current data flow:

```text
OrderDetailScreen
  → buildOrderEditSavePlan (pure diff/validation boundary)
  → patchOrder (existing permission + store scope + CAS)
  → returned updated_at
  → patchOrderFinance (existing finance permission + validation + CAS)
  → cache/local-draft reconciliation
```

No server route, database schema, production dependency or authorization rule changes in this implementation.

| Option                                         | Reliability and cost                                                                                                | Decision                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Keep forcing two manual saves                  | Avoids orchestration but contradicts the page-level save action and creates user error.                             | Rejected.                                                                         |
| Run both requests in parallel                  | Lower nominal latency but both requests race on the same version and can produce deterministic conflicts.           | Rejected.                                                                         |
| Sequential client plan over existing endpoints | Preserves current authorization, CAS, audit behavior and rollback path; requires explicit partial-success recovery. | Chosen for the current two domains.                                               |
| New server-side composite command              | Can provide a single transaction and reconciliation contract, but adds API/data/security migration cost.            | Deferred until all-or-nothing behavior or a third persistence domain is required. |

Upgrade to a server-side atomic composite command if the edit session gains a third independent persistence domain or the business requires ordinary information and quote changes to be all-or-nothing. That change needs a separately approved API/data/security review.

The current patch is rollback-safe: remove the client save-plan integration and helper while leaving both existing endpoints unchanged. Do not roll back by deleting saved order data or rewriting audit history.

## 11. Verification record

Verified locally on 2026-07-17:

- focused save/offline regression set: 5 files, 26 tests passed;
- full Vitest suite: 208 files, 1433 tests passed;
- `npm run lint`, `npm run typecheck`, `git diff --check` and the production build passed;
- browser execution confirmed request order `routine → finance`, exact `updated_at` handoff, one request per step, the combined success message and persisted mock values after reload;
- visual evidence: `screenshots/order-detail-combined-save-desktop.png` (synthetic mock order).

The browser runner's final process exit remained conditional because the post-reload assertion initially selected the hidden duplicate responsive rendering. The locator was corrected to select any visible match, but was not rerun after the browser verification retry cap. This is a test-harness evidence gap, not an observed product failure.
