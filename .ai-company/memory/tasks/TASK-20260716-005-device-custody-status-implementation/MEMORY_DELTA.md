# Memory Delta — TASK-20260716-005-device-custody-status-implementation

## Candidate project facts

- **Fact:** `repair_orders.device_custody_status` uses nullable `with_shop | with_customer`; `NULL` means legacy unknown and is never bulk backfilled. Production migration `20260716235650` left all 6298 historical rows NULL and sets `with_shop` only as the future omitted-value default. Source: migration/domain/pgTAP and production postchecks. Status: scoped_verified. Owner: DATA. Review trigger: schema change.
- **Fact:** production application SHA `452f8985` is live through Vercel deployment `dpl_9ovqtzqJ9ZuAnNd852skDYFtC7Gv`; its aliases, anonymous boundary and task-related runtime errors were checked. Source: Vercel deployment/build/runtime evidence. Status: scoped_verified, drift-prone. Owner: RELEASE. Review trigger: every release.
- **Fact:** offline order create remains disabled and fail closed through a service-role-only RPC returning `blocked_operation`; activation still requires a separate migration, HMAC configuration and release gate. Source: applied migration and ACL postcheck. Status: verified. Owner: BACKEND/RELEASE. Review trigger: offline activation proposal.

## Candidate department updates

- **BACKEND/DATA:** verified in production schema: physical custody writes use version-locked atomic RPCs; custom workflow status codes remain text and are validated against the same store's enabled definitions; terminal correction/return evidence is immutable.
- **FRONTEND/PRODUCT:** verified in app/E2E: create defaults to explicit “设备留店”; customer-held hides/clears unlock input; mobile detail renders the custody card below the sticky workflow header.
- **QA/SEC:** verified across app and pgTAP: exception-only cancellation is derived as cancelled; customer-held orders are excluded from false pickup/return paths; browser roles cannot execute custody RPCs and event payloads never include unlock secrets.

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
