# Checkpoints

## 2026-07-12T09:43:25Z — WP-00 local implementation gate

### Completed facts

- Added fail-closed store/response/request-generation/expiry checks for invite and kiosk one-time codes, plus a delayed-response store-switch integration test.
- Extended `StoreContext.permissions` with server-computed settings, member, kiosk, message-template, read, and audit capabilities without changing permission actions or role matrices.
- Gated Settings and Messages queries/actions; `/settings` now defaults to `account`, preserves denied deep links, and exposes explicit loading/error/read-only/no-permission states.
- Removed ChinaTech/Floridia fallback identity from print, inventory receipt, order/customer/buyback messages, Kiosk, default settings initialization, and partial settings updates.
- Added a shared tenant output identity resolver and prevented print/send actions while the current tenant identity is not ready.
- Removed the tracked duplicate `message-settings.repository.test 2.ts`.

### Evidence

- `npm run agents:check`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npx vitest run --maxWorkers=2`: 125 files, 829 tests passed.
- `npm run build`: passed outside the filesystem sandbox; the first sandboxed attempt failed only because Turbopack could not bind its internal port.
- `git diff --check`: passed before this checkpoint.

### Decisions

- Kept the existing server permission action matrix and projected capabilities from it.
- Kept address/contact omissions as visible warnings while requiring a current-tenant store name for customer output; no fiscal-compliance claim is made.
- Kept `/settings?section=...` as the compatibility protocol for WP-01.

### Open risks / approvals

- Historical non-default `store_settings` rows may already contain old ChinaTech/Floridia defaults. Only a read-only contamination audit is authorized; corrective DML requires Owner approval and preview.
- WP-05/06 transactional RPC work remains behind the database approval gate.
- `main` push and deployment remain unapproved.

### Next executable action

Implement WP-01 section registry, overview, mobile single-column entry list, desktop sticky rail, and current-section query gating. Stop if the independent WP-00 security review finds a P0/P1 defect.

## 2026-07-12T09:56:52Z — WP-00 security correction and closeout gate

### Correction to the earlier checkpoint

- The 09:43 checkpoint reflects an intermediate snapshot. Address/contact omissions are no longer warning-only: customer-facing output now fails closed unless the active tenant has a name, address, at least one contact method, an explicit message signature, and an explicit print footer.
- Historical legacy identity contamination is no longer audit-only at runtime. Non-default tenants whose resolved identity matches the known ChinaTech/Floridia fallback fingerprint are quarantined and cannot use that identity for messages, print, receipts, quotes, or Kiosk display.
- This entry appends the corrected state and does not rewrite the earlier evidence.

### Security review

- Independent security review: PASS, with no remaining P0/P1 blocker.
- One-time invite and Kiosk codes require matching requested/response/current store IDs, the current request epoch, and a valid unexpired server expiry.
- Clipboard success is reported only after the Clipboard API promise resolves.

### Latest validation evidence

- `npm run agents:check`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- Targeted regression: 15 files, 136 tests passed.
- Full regression after the security fixes: 125 files, 832 tests passed with two workers.
- `npm run build`: passed on the latest snapshot outside the filesystem sandbox because Turbopack requires an internal port bind.
- `git diff --check`: passed before this checkpoint.

### Non-blocking follow-up

- WP-01: add current-view query activation, including direct read-capability gates, and add an ordinary-employee no-expected-403 browser flow.
- WP-03: add a unified “前往店铺资料” recovery link for output identity blockers.
- Add a dedicated Kiosk delayed-response UI integration test when the Kiosk section is extracted; the shared tenant/epoch/expiry helper is already covered.

### Next executable action

Create the local WP-00 commit without pushing, then begin WP-01 from the approved section-registry, overview, responsive-shell, and query-activation contract.

## 2026-07-12T10:42:20Z — WP-01 overview and responsive shell closeout

### Completed facts

- `/settings` now opens a compact, searchable overview grouped into personal/access, store operations, business rules, and output/data; all nine existing `?section=` deep links remain compatible.
- Navigation uses real links and `aria-current`, so refresh, browser back, and browser forward preserve the selected section. Invalid section values fail safely to overview.
- The responsive shell uses a mobile single-column overview, a two-column tablet overview, and a desktop sticky settings rail measuring 208/224/240px at the approved 1024/1280/1440 breakpoints. Content remains at or below 980px.
- Store context is the only shell-level query. Account, settings, suppliers, members, access requests, Kiosk, and workflow queries activate only for the current view and required server capability. `/settings` no longer triggers the global workspace preload.
- Settings and message-template drafts are bound to the active store. Settings save results are accepted only when request store, response store, cached active store, and active store scope still agree.
- Member self-management protection now compares the active `membershipId` with `StoreMember.id`; the account query is no longer loaded as a hidden dependency of the member section.
- Store settings/account load failures are section-local. Blocked/unavailable deep links do not render protected data or issue the blocked domain query.
- The global “邀请成员” shortcut now points to `/settings?section=members`.

### Validation evidence

- Independent WP-01 integration/security closeout: PASS; no P0/P1 blocker.
- `npm run agents:check`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- Full unit/integration regression: 132 files, 854 tests passed with two workers.
- Dedicated settings Playwright: 9/9 passed, covering six viewports, nine deep links, invalid fallback, history, mobile center taps, page overflow, and blocked member-domain zero requests.
- `npm run build`: passed on the latest snapshot outside the filesystem sandbox because Turbopack requires an internal port bind.
- In-app browser: meaningful content, no framework error overlay, no console errors, 390px and 768px document width matched viewport, 44x44 mobile return target, 1440px rail 240px/sticky, desktop content 884px.
- `git diff --check`: passed before this checkpoint.

### Visual evidence

- `screenshots/responsive-density/settings/overview-390x844.jpg` — 390px viewport, full-page mobile overview.
- `screenshots/responsive-density/settings/store-390x844.jpg` — 390px viewport, full-page mobile store subpage.
- `screenshots/responsive-density/settings/overview-768x1024.jpg` — tablet two-column overview with settings rail hidden.
- `screenshots/responsive-density/settings/overview-1440x800.jpg` — desktop overview with global sidebar and 240px settings rail.
- The two 390px artifacts are full-page captures, so their pixel heights exceed the viewport height named in the files.

### Documentation impact

- Added `DOCUMENTATION_IMPACT.md` with user, developer, QA, security, and release mapping.
- No database, public API, deployment, or rollback documentation changed because WP-01 made no schema or production change.
- A user operator guide remains deferred until WP-03 through WP-07 finish the child workflows.

### Non-blocking follow-up

- WP-02 must route rail links, overview cards, mobile return, tablet return, app navigation, store switching, and browser history through the shared dirty guard; native hard reload can only use `beforeunload`.
- Add response-store verification to message-template mutations as later defense in depth; current store-bound drafts already prevent cross-store rendering.
- Kiosk and member/access partial-query failure detail remains in their later child-function work packages.

### Next executable action

Create the local WP-01 commit without pushing, then begin WP-02 with strict section payloads, `updated_at` compare-and-swap, section drafts, save states, and the shared navigation guard. Database migration is not required for the local WP-02 contract.
