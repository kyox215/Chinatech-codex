# Memory Delta — TASK-20260719-006-ai-natural-language-order-actions

## Candidate project facts

- **Fact:** Order Query V2 resolves symbolic relative dates on the server using the ChinaTech pilot
  timezone and independently reconciles device/date/service/parts constraints over model plans.
  Source: Query V2 contract, intent router and date resolver. Status: verified. Owner: RepairDesk.
  Review trigger: multi-timezone store rollout.
- **Fact:** `fault_prices` supports quote-catalog evidence only; it cannot prove a physical service
  was completed. `parts_status` is an order-level workflow marker, not a supplier PO. Source:
  repository/data review and ADR. Status: verified semantic limit. Review trigger: new execution or
  requisition data model.

## Candidate department updates

- **Security/release:** inline writes are single-order, server-generated, owner-only, confirmed,
  versioned and idempotent, but production activation remains a separate D4 decision. Source:
  action service, capability flag and release docs. Status: implemented/dormant.

## Candidate decisions / ADRs

- Evidence-qualified Query V2 with no migration was selected over prompt-only matching and inferred
  procurement/performed-repair claims. Source: `ADR.md`. Status: accepted.

## Candidate lessons and capability evidence

- Long webpack-dev E2E sessions can intermittently serve an invalid HMR chunk in this isolated
  symlinked worktree. The production webpack build passed; browser cases were verified in small,
  fresh-server groups. Source: retained Playwright failure traces plus aggregate green reruns.
  Status: tooling limitation, not a product exception. Review trigger: E2E runner isolation change.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
