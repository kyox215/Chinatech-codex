# Execution Plan — TASK-20260716-003

## Outcome contract

Deliver one compatible release that fixes the customer finance presentation contract and order correction boundary without deleting financial evidence. Implementation uses an isolated branch, one writer, additive migrations, server-enforced capabilities, atomic mutations and a staged release.

## Baseline

- Original code baseline: `origin/main@6717932e316cbe5054709646ca7ea1087f517a49`.
- Rebased release baseline: `origin/main@184672fef090a6fa5d467b5389daec736662af63`; candidate commit `d6f67569d39ed579c5794939b3534682462ba230` plus final evidence/doc amendment.
- Worktree: `/private/tmp/repairdesk-customer-finance-correction-20260716`.
- Branch: `codex/customer-finance-correction-20260716`.
- Shared checkout is intentionally not used for business writes.
- Production validation uses a current-schema PG17 clone because unrelated historical migrations are not globally replayable. The exact release chain `20260716175044 → 20260716175056 → 20260716221119 → 20260716221139 → 20260716221159 → 20260716221448` was replayed successfully; the final four task versions were then serialized, applied and postchecked in production.

## Product contract

### Customer finance

- `lifetime_quoted_amount`: sum of quotation amounts for valid orders.
- `outstanding_amount`: sum of positive balances for valid orders.
- Valid means active record lifecycle and not cancelled in legacy/canonical state.
- `lifetime_collected_amount` is not inferred from `is_paid`; expose only when the complete ledger contract supports collection/refund/reversal history.
- UI labels are `累计订单额` and `待收`.

### Customer state

- Repair and payment state are independent and both visible.
- Repair: `在修 N` or `已结案`.
- Payment: `待收 €X` or `已结清`.
- Completed plus positive balance is `已交付 · 待收`, not silently hidden.

### Order corrections

- Active-order routine edits remain field/capability scoped.
- Terminal-order edits use explicit correction/reopen mutations with reason and before/after.
- Manager and Owner may correct/reopen; Owner alone may void.
- Void preserves all evidence and excludes the order from valid customer aggregates.
- Hard purge is excluded.

## Architecture decision

### Option rejected: patch the existing v2 formula and keep generic update

This is smaller but keeps ambiguous field names, status precedence, partial-write finance changes and UI role guessing. It cannot safely satisfy the audit and lifecycle requirements.

### Selected: additive v3 facts + atomic lifecycle RPCs

- Add lifecycle/correction data compatibly.
- Add a v3 customer list RPC with explicit output names; retain v2 for rollback.
- Add explicit server capability projection.
- Add atomic correction/reopen/void functions following the payment RPC's lock/version/idempotency/audit pattern.
- Switch app reads/mutations only after types and contract tests exist.

## Work packages

### WP-00 — Baseline and release safety

Outputs:

- task memory and active context;
- exact remote migration list and linked project identity;
- production read-only schema/RPC/grant/RLS parity report;
- release lock and stop conditions;
- focused current tests before edits.

Stop if remote identity is ambiguous, migration history diverges, recovery cannot be proven or another release executor is writing.

### WP-01 — Customer aggregate v3

Outputs:

- additive tenant-safe RPC/facts contract;
- explicit client/server/type names;
- v2 compatibility path;
- cancellation/void exclusion and canonical active calculation;
- SQL and TypeScript parity tests.

### WP-03 — Capabilities and minimal payload

Outputs:

- `canEditIntake`, `canEditRepair`, `canAdjustFinance`, `canCollectPayment`, `canTransition`, `canCorrect`, `canReopen`, `canVoid`;
- UI based on capabilities, not role strings;
- changed-fields-only update payload;
- server refusal for forged fields and cross-store IDs.

### WP-04 — Terminal correction and reopen

Outputs:

- immutable correction record;
- atomic mutation with order lock, optimistic version, idempotency, reason, before/after, event and audit;
- terminal finance mutation closed until append-only refund/reversal rules are supported;
- Manager/Owner tests.

### WP-05 — Owner void

Outputs:

- additive `record_state` and void metadata;
- Owner-only atomic void;
- paid/evidenced order policy fails closed unless a supported accounting resolution is supplied;
- audit view/filter and aggregate exclusion.

### WP-02 — UI

Outputs:

- customer list and detail labels/status parity;
- accessible correction/reopen/void flows on desktop and mobile;
- no-permission, stale-version, duplicate-submit, error and pending states;
- query invalidation for detail/list/stats.

### WP-06 — Integrity and anomaly evidence

Outputs:

- read-only anomaly queries;
- safe CRM FK repair only if remote facts support it;
- no automatic bulk financial data correction;
- before/after counts and rollback constraints.

### WP-07 — Verification and release

Required:

- focused unit/repository/router tests;
- migration replay and pgTAP;
- `npm run agents:check`, lint, typecheck, full test and build;
- browser verification at 390, 430, 768, 1024, 1280 and 1440 where applicable;
- redacted screenshots;
- independent DATA/SEC and QA decisions;
- migration list + dry-run immediately before production apply;
- post-apply metadata, grants, RLS, RPC and data sanity queries;
- scoped commit, rebase/fast-forward integration and main push.

## Change budget

Allowed modules:

- `src/features/customers/**`
- `src/features/orders/**`
- `src/lib/repairdesk/**`
- `src/server/api/**`
- `src/server/permissions*`
- `supabase/migrations/**`
- `supabase/tests/**`
- directly relevant docs/tests/task memory.

Forbidden without Plan Delta:

- dependency upgrades;
- unrelated settings/buyback/inventory refactors;
- historical migration rewrites;
- customer data bulk updates;
- hard delete/purge;
- external customer communication.

## Approved Plan Delta — direct lifecycle compatibility and evidence

The implementation may also touch directly related `src/server/repairdesk-shared.ts` lifecycle compatibility, customer-kiosk/order mock projections, ESLint generated-artifact ignore coverage and task-specific E2E/mock fixtures. These files may only carry the same customer-finance/lifecycle contract or its verification; no kiosk feature, shared lint policy or unrelated workflow expansion is authorized.

## Rollback

- UI/API entry points behind compatible server behavior; remove/disable new mutation routes if unhealthy.
- Keep additive schema, corrections and ledger evidence; use forward-fix instead of destructive down migration.
- Retain v2 customer RPC while v3 is observed.
- Void is reversible only through an audited Owner restore path if implemented; never delete audit/ledger to roll back.
- If production DB gate fails, push tested code/migration only if application remains backward compatible; otherwise stop before main.
- App deployment gate: the exact pushed `main` SHA must reach Vercel `READY`, then pass a protected-route/API smoke without customer PII and show no new task-related 5xx or terminal-RPC contract errors. If it fails, redeploy prior app SHA `184672fe` while retaining the additive database schema, hide the new actions if needed, and forward-fix; never down/drop lifecycle, ledger or audit objects.

## Release stop conditions

- remote project/migration history not proven;
- any cross-store or unauthorized mutation;
- partial write, duplicate correction or stale overwrite;
- customer v3/detail mismatch;
- cancelled/voided amounts still counted;
- payment ledger and order balance mismatch;
- missing audit actor/reason/before/after;
- failing high-risk test, build, browser flow or independent review.
