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

## 2026-07-12T12:14:05Z — WP-02 conflict-safe drafts and navigation closeout

### Completed facts

- Replaced the permissive full-row settings update with a strict `store / notifications / rules` discriminated request. The authenticated actor remains the authoritative store; `expectedStoreId` detects stale client context only.
- Added section-only `store_id + updated_at` compare-and-swap. A stale version returns a stable 409 before audit or Realtime; warranty text is derived on the server.
- Added store-bound section drafts with explicit base/value/version/conflict state. Background refresh never overwrites local dirty input; explicit conflict rebase uses base/local/server three-way field merging.
- Added clean, dirty, saving, saved, validation-error, conflict, offline, and generic-error UI states with structured field errors and focus recovery.
- Added one shared navigation guard for Links, imperative routes, AppSidebar, CommandPalette, MobileWorkspaceDock, ScanSearch, store switch/create, sign-out, back/forward, and native `beforeunload`.
- Multiple dirty settings sections are saved sequentially with CAS version chaining or discarded together. Multiple independent guard sources resolve before one pending transition runs. Account display-name changes, including an invalid empty value, are guarded.
- Store switch/create failures no longer clear the current settings draft; successful active-store changes still hide the previous tenant immediately through the active-store scope gate.

### Validation evidence

- Independent security/architecture review: PASS, P0=0 and P1=0; 7 files / 51 security-contract tests passed.
- Independent UI/navigation/QA re-review after corrections: PASS, P0=0 and P1=0; 3 files / 23 target tests and four added navigation E2E cases passed independently.
- `npm run agents:check`: passed.
- `npm run lint`: passed on the latest code snapshot.
- `npm run typecheck`: passed on the latest code snapshot.
- Latest targeted draft/guard/screen regression: 3 files / 24 tests passed.
- Latest bounded full regression: 136 files / 887 tests passed with four workers.
- Dedicated Settings Playwright: 16/16 passed with one worker. It covers six viewports, nine deep links, blocked-query zero requests, rail, AppSidebar, CommandPalette, MobileWorkspaceDock, ScanSearch, store switching, and back/forward.
- `npm run build`: passed outside the filesystem sandbox because Turbopack requires local process/port access.
- `git diff --check`: passed before this checkpoint; `next-env.d.ts` has no remaining generated drift.

### Decisions

- Kept the existing `store_settings.updated_at` column as the optimistic version; WP-02 requires no migration.
- Kept overlapping local field edits after an explicit rebase while absorbing server-only field changes. Rebase never auto-saves.
- Kept browser hard reload on the native `beforeunload` contract; a custom three-choice dialog is only promised for application-controlled transitions.
- Strict legacy `{ input }` compatibility is intentionally not added because it would reopen over-posting and full-row overwrite paths.

### Residual risks / approvals

- Settings update and audit log are not one database transaction. A successful CAS followed by audit failure can return an API failure after the row changed. A transactional RPC or outbox remains a future production-strength option requiring its own approval.
- Realtime delivery is best-effort; another session can temporarily retain an old cache until normal revalidation.
- `getStoreSettings()` still initializes a missing row during read. Release preparation must verify one settings row per active store; changing initialization semantics is outside WP-02.
- The conflict card does not yet render a field-by-field server/local diff. Three-way merging prevents server-only field loss, and overlapping local values survive only after the user explicitly selects rebase.
- Local Next dev cold compilation can make route assertions slower and can emit canceled RSC `ECONNRESET` noise; the deterministic one-worker 16-test gate passed.
- No migration, production data action, role change, push, or deployment was performed. All such gates remain closed.

### Next executable action

Create the scoped local WP-02 commit without pushing. Then rehydrate the approved WP-03 child-function scope, start with the unified output-identity recovery link and the account/store workflow slice, and stop at any database, role-semantics, retention, production, push, or deployment gate.

## 2026-07-12T13:01:37Z — WP-03A recoverable customer-output blockers

### Completed facts

- Added stable output block codes, sanitized missing-field identifiers, and recovery targets without changing the WP-00 readiness requirements or `canOutput` decision.
- Added one shared responsive recovery card for loading, failed settings read, store-context mismatch, store-profile gaps, and notification-only gaps.
- Integrated the card into customer messages, order notifications, approval requests, and inventory sale receipts. All existing send/print guards remain active while blocked.
- Settings recovery opens a new tab with `noopener noreferrer`, preserves the original dialog, and provides “重新检查资料” using the existing actor-bound query refetch.
- Message selectors and body are disabled while identity is blocked, so a loading/retry/context recovery cannot silently overwrite an editable draft.
- Added defensive failure closure when active-store settings lack a `store_id`; mismatch and missing binding never expose a Settings destination.
- Browser verification found the mobile order header effect ran before the header mounted behind the initial skeleton. The fallback offset covered the first customer link. Remeasuring after the first orders request settles restores standard pointer interaction without forced clicks.

### Review and validation

- Independent security review after corrections: PASS, P0=0 / P1=0.
- Independent UI/accessibility review after corrections: PASS, P0=0 / P1=0.
- Focused regression: 5 files / 21 tests passed.
- Static gates: agents check, lint, typecheck, and diff check passed.
- Full bounded regression: 139 files / 902 tests passed with two workers.
- Output-recovery Playwright: 2/2 passed at 390x844 and 1440x900.
- Settings Playwright: 16/16 passed across the six approved viewports and global dirty-guard surfaces.
- Production build passed outside the filesystem sandbox due Turbopack local process/port requirements.
- A four-worker exploratory run produced two timing failures in an unrelated pre-existing Radix picker file; that file passed 5/5 alone and the full two-worker gate passed 902/902.

### Visual evidence

- `screenshots/responsive-density/settings/output-recovery-390x844.png`
- `screenshots/responsive-density/settings/output-recovery-1440x900.png`
- Both are mock-only and mask notification type, phone, and message body.

### Residual risks / follow-up

- Recheck success can remove the focused button; explicit post-recovery focus transfer remains a P2 accessibility follow-up.
- React Query refetch may resolve an error result rather than throw; persistent failure still remains visibly blocked, but inline retry-failure copy is best effort.
- A ready-to-ready background identity update can still regenerate an open message draft; a later dirty guard should distinguish background refresh from explicit template regeneration.
- Inventory receipt has source-level triple guards and shared-component coverage but no isolated UI unit harness; the responsive E2E covers the order-message integration.
- Toast-only order-list/buyback, silent detail print, Messages health, and authenticated/public Kiosk recovery remain separate WP03 slices.
- No migration, production action, role change, retention change, external message, push, or deployment occurred.

### Next executable action

Create the scoped local WP03-A commit without pushing. Verify the boundary, then begin WP03-B account/store extraction and completion while preserving current queries, strict section payloads, CAS, dirty guards, capabilities, and store-switch semantics.
## 2026-07-12T14:03:54Z — Owner转向P0在店设备与订单归档修正；设置中心WP00-WP02及WP03A已本地提交，WP03B账号/店铺拆分存在未提交工作与3张响应式截图，当前快照未完成最终验证，必须原样保留

- **Phase:** paused_for_order_archive_p0
- **Completed/current state:** Owner转向P0在店设备与订单归档修正；设置中心WP00-WP02及WP03A已本地提交，WP03B账号/店铺拆分存在未提交工作与3张响应式截图，当前快照未完成最终验证，必须原样保留
- **Next:** 恢复时从/private/tmp/repairdesk-settings-center-20260712读取TASK/CHECKPOINTS/HANDOFF，先审查未提交WP03B diff并完成目标测试，不得把新归档任务改动混入
- **Decision:** 设置中心任务暂停但不关闭，不提交、不推送、不清理现有工作
- **Blocker:** Owner已将P0订单可见性修正设为当前优先事项
- **Evidence:**
  - branch codex/settings-center-v2-20260712 ahead 4; uncommitted settings WP03B files/screenshots preserved; no production/push
- **Recorded by:** Integration Lead

## 2026-07-12T14:54:32Z — WP03-B account and store settings completed

### Completed facts

- Extracted account and store presentation from `SettingsScreen` while keeping query, mutation, CAS, dirty guard, capability, active-store scope, switching, creation, and cache orchestration in one owner.
- Account now separates account nature, email verification, and current-store role; `/account` remains the only email/password/contact security workflow.
- Store now separates workspace switching, editable or semantic read-only profile, customer-output readiness, and independent-store creation with explicit confirmation.
- Saved customer-output state and unsaved draft projection are distinct. Materialized drafts now carry `activeDrafts.storeId` into the tenant resolver; a draft can never masquerade as active or lose its tenant scope.
- The client prevalidates user-editable fields with the same input schemas used by the API; store scope, CAS metadata, permissions, and full validation remain server-authoritative.
- Account save, store switch, and store creation failures render inline recovery while preserving drafts. Dirty settings block confirmed store creation until the user resolves the existing navigation guard.
- Settings routes no longer render the global mobile quick dock because it covered form controls. Mobile return remains guarded, and `elementFromPoint` verifies a focused address field stays the top hit target.
- Mobile save and independent-store confirmation actions are at least 44px; viewer copy distinguishes current-store read-only access from account-qualified independent-store creation.

### Review and validation

- Independent security review: PASS, P0=0/P1=0.
- Independent UI/accessibility review: PASS, P0=0/P1=0.
- Dedicated Settings Playwright: 21/21 passed with one worker across 390, 430, 768, 1024, 1280, and 1440 widths.
- Focused component/model/screen/dock regressions passed, including ready-to-ready and blocked-to-projected-ready output identity, local validation without API calls, creation confirmation plus dirty guard, read-only semantics, and dock visibility.
- `npm run typecheck`, changed-file ESLint, `git diff --check`, and production `npm run build` passed. Build required sandbox escalation because Turbopack binds a local helper port.
- An exploratory full Vitest run was not a clean gate because unrelated 5-second timeouts recurred in `order-option-pickers` and order-data workbook tests under suite load. Both failing files passed 5/5 alone; no Settings test failed in the final focused runs.

### Visual evidence

- `screenshots/responsive-density/settings/wp03b-account-390x844.png`
- `screenshots/responsive-density/settings/wp03b-store-1280x800.png`
- `screenshots/responsive-density/settings/wp03b-store-create-confirm-1280x800.png`
- `screenshots/responsive-density/settings/wp03b-store-draft-390x844.png`
- `screenshots/responsive-density/settings/wp03b-store-readonly-390x844.png`

### Residual risks / approvals

- Self-service store creation retains the current authenticated, email-verified account policy. Changing that role/product policy remains an Owner gate.
- Account profile updates and audit writes remain non-transactional; no database or architecture change was introduced.
- Mock screenshots can show the Next dev indicator; it is not a production control.
- No migration, production data action, role or retention change, external message, push, or deployment occurred.

### Next executable action

Create one scoped local WP03-B commit without pushing, verify its file boundary, then begin WP03-C notifications/rules extraction and completion.
