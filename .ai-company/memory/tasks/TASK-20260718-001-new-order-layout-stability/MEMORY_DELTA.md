# Memory Delta — TASK-20260718-001-new-order-layout-stability

## Candidate project facts

- **Fact:** new-order unknown mode can retain customer report, quote items and deposit only in the 14-day local draft while online create/outbox must resolve to the canonical unknown description, empty quote items and zero deposit. **Source:** implementation, offline tests and independent DATA/SEC review. **Status:** locally verified. **Owner:** FE/DATA/SEC. **Scope:** new-order intake and offline draft sync. **Review trigger:** offline TTL/outbox or intake contract change.
- **Fact:** this UI-only change requires no Supabase schema migration; production already contains `20260717213518_order_diagnosis_quote_atomic`. **Source:** local migration diff and linked migration history. **Status:** verified, final no-op pending latest-main parity. **Owner:** DATA/Release. **Scope:** this task. **Review trigger:** any new server field/RPC requirement.

## Candidate department updates

- **Frontend/UX:** new-order hierarchy is customer/device → quote → compact report → unlock in DOM/focus order; at xl it becomes independent left/center/right columns. CSS `order` must not create a visual order different from keyboard/reader order. **Status:** browser verified. **Source:** layout E2E/screenshots. **Review trigger:** new-order responsive redesign.
- **Data/Security:** paused local report/quote/deposit keys must be removed at draft-to-outbox promotion, even though a defensive sync adapter already ignores them. **Status:** tests verified. **Source:** offline service/adapter tests. **Review trigger:** payload allowlist or outbox promotion change.

## Candidate decisions / ADRs

- Quote controls remain mounted and disabled in unknown mode so the page geometry stays stable and the local draft survives; submission semantics are resolved separately through a pure intake resolver. **Status:** locally verified. **Owner:** Product/FE. **Scope:** new-order intake. **Source:** source, unit and browser tests. **Review trigger:** quote workflow redesign.
- Wide new-order layout uses independent columns instead of row-spanning grid tracks, preventing a tall quote card from creating blank space between compact right-column cards. **Status:** browser verified. **Owner:** UX/FE. **Scope:** `>=1280px`. **Review trigger:** workspace column/breakpoint change.

## Candidate lessons and capability evidence

- Browser measurement must normalize rects to the scrollable workspace rather than `window.scrollY`, because RepairDesk uses internal scroll containers. **Status:** observed and fixed in E2E. **Owner:** QA. **Scope:** layout-stability tests. **Review trigger:** shared browser measurement helper.
- A production migration history ahead of Git main is a hard serialization gate even for a no-migration UI release; wait for the migration owner to push complete code rather than copying SQL or repairing history. **Status:** resolved correctly in this task. **Owner:** Release/DATA. **Scope:** concurrent releases. **Source:** linked list, employee-invite worktree inspection and later aligned dry-run. **Review trigger:** any future migration/Git parity drift.
- Next.js Route files may export only supported HTTP handlers/config; reusable validation helpers belong in ordinary feature modules even when route tests import them. **Status:** build-verified integration fix. **Owner:** FE/Auth. **Scope:** App Router route handlers. **Source:** failed then passing Webpack build. **Review trigger:** new route helper export.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
