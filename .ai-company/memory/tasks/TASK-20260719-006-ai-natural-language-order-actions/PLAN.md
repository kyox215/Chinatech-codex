# Execution Plan — TASK-20260719-006

## Release contract

- **Writer:** main integration thread only, isolated worktree branch
  `codex/ai-natural-order-actions-20260719`.
- **Reviewers:** query/data architecture, UI/accessibility, and security/QA/release agents are
  read-only.
- **Rollback:** disable the narrow feature flag first, then restore the previous READY Vercel
  deployment. No database objects are added or removed.

## Phase 1 — shippable read path

1. Extend the strict model tool schema with server-resolved date expressions, quote-service
   groups, order-level parts state, and bounded prior normalized filters.
2. Independently parse high-confidence device/date/service/payment/parts constraints from the raw
   user text and reconcile them with the model plan. A conflict narrows or clarifies; it never
   broadens.
3. Apply filters through the existing actor/store-scoped repository. Return evidence chips and
   safe matched reasons, never PII or finance values.
4. Merge model usage and processing mode into one collapsed composer row.
5. Render order cards as non-interactive articles with inline details; retain one explicit order
   link.

## Phase 1.5 — dormant action path

1. The model remains read-only and cannot emit a mutation.
2. Server-generated action candidates are available only when
   `AI_ORDER_INLINE_ACTIONS_ENABLED=1`, the store is allowlisted, and the actor is owner.
3. Only single-order parts workflow markers are eligible. Confirmation supplies order number,
   expected version, and a stable UUID idempotency key.
4. The server reloads the order, recalculates permissions/candidate status, and then calls the
   existing atomic transition command. No batch, patch, payment, message, procurement, or cost
   operation is exposed.
5. Production keeps this flag off until a separate D4 approval.

## Verification

- Contract, parser, date/DST, repository, provider, route/body-limit, permissions, action replay,
  component and API tests.
- `npm run agents:check`, lint, typecheck, full tests and production build.
- Playwright at 390, 430 and desktop widths; capture compact control, applied filters, inline
  details and explicit order link.
- Refresh `origin/main`, integrate without force, push exact SHA, verify Vercel READY and domain
  aliases, then perform anonymous/cross-origin and read-only page/API smoke checks.

## Evidence semantics

- `exact`: device/date/workflow/payment fields stored directly on the order.
- `quoted`: repair catalog match comes from a quote line; it is not proof the physical repair ran.
- `order_level`: parts state is the current order-level marker and may not represent a supplier PO.
