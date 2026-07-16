# Memory Delta — TASK-20260716-005-device-custody-status-implementation

## Candidate project facts

- **Fact:** `repair_orders.device_custody_status` uses nullable `with_shop | with_customer`; `NULL` means legacy unknown and is never bulk backfilled. Source: migration/domain tests. Status: verified locally. Owner: DATA. Review trigger: schema change.
- **Fact:** pushing RepairDesk `main` automatically deploys production on Vercel, while the current production DB lacks the custody column. Source: 2026-07-16 read-only Vercel/Supabase inspection. Status: live, drift-prone. Owner: RELEASE. Review trigger: every release.
- **Fact:** offline order create remains disabled and fail closed because production migration history records a draft while the expected RPC is absent. Source: linked schema inspection and migration stub. Status: verified. Owner: BACKEND/RELEASE. Review trigger: offline activation proposal.

## Candidate department updates

- **BACKEND/DATA:** physical custody writes use a version-locked atomic RPC; custom workflow status codes remain text and are validated against the same store's enabled status definitions.
- **FRONTEND/PRODUCT:** create defaults to explicit “设备留店”; customer-held hides/clears unlock input; mobile detail renders the custody card below the sticky workflow header.
- **QA/SEC:** exception-only cancellation is derived as cancelled; customer-held orders are excluded from pickup/notification/kiosk paths; event payloads never include unlock secrets.

## Candidate decisions / ADRs

- Keep custody as current location, not order type or accessory notes; use `delivered_at` only for an actual handover.
- Completed orders cannot be corrected back to shop-held without rework/reopen; cancelled shop-held devices use the dedicated return confirmation.
- Preserve unknown legacy facts; null-to-customer backfill does not fabricate historical delivery time.

## Candidate lessons and capability evidence

- SQL reviews must cover Postgres three-valued logic for explicit JSON null, custom text workflow statuses, and live production type/signature parity.
- A fixed mobile header can leave a logically rendered card at `(0,0)` behind the overlay; verify visible element geometry, not just DOM text.
- Guarded multi-step notification/kiosk writes preserve custody invariants but remain residual transaction-hardening work.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
