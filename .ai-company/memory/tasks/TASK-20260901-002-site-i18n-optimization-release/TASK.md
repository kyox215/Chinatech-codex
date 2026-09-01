---
schema_version: 1
task_id: "TASK-20260901-002-site-i18n-optimization-release"
title: "按优化报告完成高优先级网站与三语改进并发布"
status: "active"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "Hexiang Huang / Owner"
departments: ["ARCH", "DOC", "FE", "PRODUCT", "QA", "RELEASE", "SEC", "UX"]
created_at: "2026-09-01T07:54:13Z"
updated_at: "2026-09-01T20:37:00Z"
---
# Task — 按优化报告完成高优先级网站与三语改进并发布

## Owner request

- 按 2026-09-01 项目/网站/语言审计报告开始执行优化目标。
- 完成后正常推送 `main` 并部署现有生产网站。

## Business value

完成审计报告中的高优先级客户语言、回归门禁和网站可靠性改进，并安全发布到 main/生产

## Scope in

- Release 1 — customer/i18n quality: make the fixed-Italian Kiosk consistently Italian across metadata, visible UI, ARIA, validation and safe public errors; add automatic Chromium/WebKit i18n CI coverage with non-silent prerequisites; expand untranslated-text auditing to production-reachable `.ts` UI/error sources; localize 404 and repair same-page/duplicate metadata issues; fix the bounded public-auth error states identified by the audit.
- Release 2 — employee deep-interface i18n: migrate high-confidence fixed UI copy in Scanner/Camera, Orders deep flows, Customers, Inventory and Buyback first, then Settings/Support surfaces (Messages, Finance, Toolkit, Memos, Platform/Account/AI) in bounded domain batches; preserve original dynamic business data, identifiers, canonical enum values and customer/legal-language boundaries.
- Release 3 — reliability/governance: remediate production dependency advisories only through compatible reviewed upgrades, align the declared Node runtime across local/CI/Vercel-compatible build contracts, add PII-safe root error/recovery and request-correlation observability where supported, establish forward-only evidence-retention rules, and make only translation/reliability-driven extractions from oversized modules.
- For every release unit: focused tests, full lint/typecheck/test/build, independent QA/security/architecture review proportional to risk, responsive/browser evidence, documentation and Task Memory.
- Use separate commits and staged evidence per release unit; only the Integration Lead may acquire the lease, integrate, non-force push `main`, deploy the existing Vercel project, verify canonical aliases and observe/rollback.

## Scope out

- Database/schema/migration, production/customer data, auth/permission/tenant semantics, payments, API payloads, business workflow or customer communication policy changes.
- Translating customer names, device/product data, notes, custom workflow values, identifiers, third-party content or canonical protocol/status codes.
- Automatically making print, receipt, warranty, agreement, notification or legal content tri-language; those remain a separate content/legal approval line.
- New paid services, new deployment targets/domains, secret/environment-value disclosure, dependency/framework replacement, force push, destructive cleanup, Git history rewrite or deletion of historical evidence.
- Big-bang refactoring of the 6,081/4,158/4,111-line modules. Only bounded extractions required to make an approved release testable are allowed; remaining structural work becomes separately evidenced follow-up.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- Existing audit/report memory changes are known local governance output from the immediately preceding closed task; preserve and identify them separately from business-source changes.
- One application-code writer at a time. Product/architecture/UX/security/QA/release reviewers remain read-only and do not fix their own findings.
- Do not mix dependency/runtime upgrades or broad refactors into a language-domain release without a separately frozen release unit and rollback proof.
- Customer routes remain fixed Italian and must not overwrite the employee locale Cookie. Employee switching remains `zh-CN` / `it-IT` / `en`, Chinese-default, URL-stable and in-place.
- No production login, real customer PII, mutation or form submission is required for release evidence; use synthetic/controlled fixtures and public read-only smoke.
- The Owner has authorized normal commits, non-force push to `main`, and deployment of the existing production project after applicable gates. This does not authorize secret/config-value changes, data writes, migrations, new services, new domains or force push.
- Long-running guard: each work package soft checkpoint 45 minutes, hard boundary 90 minutes; one milestone at a time, at most two active sidecar agents, no busy polling, stop on 15 minutes without effective progress or an unclosed P0/P1.

## Acceptance criteria

- [x] Kiosk fixed-Italian contract is consistent across metadata, visible UI, accessibility names, validation and public-safe failures; `/r` and employee locale Cookie isolation remain unchanged.
- [x] Automatic CI triggers on all locale/switcher/layout/provider/auth/Kiosk and release-domain paths, executes both foundational and release i18n specs in Chromium/WebKit, and cannot report a pass when required environment/setup is absent.
- [x] The audit covers production-reachable `.tsx` and `.ts` UI/error sources, classifies legacy/dynamic/customer/legal exceptions and provides reproducible per-domain residual counts.
- [x] Public 404, same-page title and `/r` duplicate-brand metadata defects are fixed; public-auth failures expose inline accessible error/retry states without changing auth semantics.
- [ ] Each employee-domain batch removes high-confidence reachable fixed Han copy from its frozen consumer allowlist for Italian/English, preserves dynamic data and has key/token parity plus default/loading/empty/error/permission/offline/browser evidence.
- [ ] Production dependency findings are either removed by compatible reviewed upgrades or retained only with explicit reachability evidence, owner and mitigation; no blind audit fix or dependency replacement.
- [ ] Node runtime declarations are aligned and exact-SHA lint/typecheck/test/build pass in the declared version and the deployment build.
- [ ] PII-safe error/recovery/observability and public security header changes have independent security review and do not break Kiosk device/camera capabilities, login, `/r`, service worker or customer-route isolation.
- [ ] New binary evidence is stored under task/CI artifact boundaries; no history rewrite or destructive repository cleanup occurs.
- [ ] Every UI release is verified at relevant 390/430/768/1024/1280/1440 widths with no page overflow, keyboard/focus/error-state checks and sanitized screenshots.
- [ ] Final exact commits are independently reviewed with no unresolved P0/P1, non-force pushed to `origin/main`, deployed to the existing Vercel production project, smoke-tested, observed and recoverable using a recorded prior READY deployment.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Owner explicitly authorizes implementation, normal `main` push and existing production deployment | observed | current Owner instruction | approved only within this frozen contract and release gates |
| 2026-09-01 audit found no P0, but Kiosk/CI/deep i18n/dependency/runtime/observability debt | verified fact | preceding task `REPORT.md` / `EVIDENCE.md` | accepted as intake baseline; revalidate before each material release |
| Current application baseline is `8e349b06...` and production READY at the audit time | point-in-time fact | preceding task E-002/E-003 | fetch/reverify before source writes and again before push/deploy |
| Current worktree has only known prior audit memory plus this task's governance writes | verified fact | `git status --short --branch` | preserve; do not treat as business-source contamination |
| Exact file allowlists, compatible dependency versions and header capability constraints | unknown | independent code/security/architecture inspection required | freeze before each writer starts |

## Decision and approval points

- Classified T3/R3/L2: broad user-visible, CI, supply-chain/runtime and production release work. Highest risks are mixed-language customer surfaces, regression-gate false positives, dependency/runtime incompatibility and production availability.
- D1/D2 delegated: reversible copy/catalog/tests/audit/docs changes; bounded UI/accessibility fixes; compatible internal extraction after independent review.
- Owner-approved D3 within scope: normal commits, non-force `main` push and deployment to the existing Vercel project after exact-SHA gates and rollback anchor.
- D3/D4 reserved/new approval: database/data/auth/permission/tenant/payment/legal-policy changes, secrets/environment values, new dependency/service/domain, breaking architecture/framework changes, destructive cleanup/history rewrite, force push or a security exception.
- Mandatory independent views before contract freeze: Product/UX customer and language-state contract; Architecture/Release phased integration and runtime/dependency boundaries; QA/Security test/threat/header/CI-gate review.

## Work packages

- WP-01 intake/contract: verify baseline, code paths and external official facts; collect 2–4 independent read-only views; arbitrate and freeze Release 1 allowlist/rollback.
- WP-02 Release 1 single writer: Kiosk + audit/CI + 404/metadata + bounded auth error improvements; immediate focused validation.
- WP-03 Release 1 independent QA/security/browser/Preview and either release or correct blocking findings.
- WP-04 Release 2 domain sequence: Scanner/Camera → Orders → Customers/Inventory/Buyback → Settings/Support; one writer and one domain-specific acceptance matrix per slice.
- WP-05 Release 3 engineering sequence: compatible dependency/runtime alignment → error/recovery/observability/header hardening → retention rules and bounded extraction only.
- WP-06 exact-SHA release/observe: acquire/reverify integration lease, commits per release unit, non-force push, existing Vercel production deployment, public/synthetic smoke, observation and rollback readiness.
- WP-07 documentation, project/department memory, capability evidence and formal closeout.

## Release 1 frozen change contract (2026-09-01)

### Decision

- Product/UX and Architecture/Release independent reviews found no P0 and three release-blocking P1 classes: mixed-language fixed-Italian Kiosk, public-auth error paths that are toast-only or can render a false success/raw provider message, and i18n browser CI that can skip and still appear green.
- Release 1 is the smallest independently deployable correction for those P1s plus the verified 404/title defects and expanded audit coverage. It does not include deep employee-page translation, dependency/Node changes, strict global CSP/HSTS/COOP, schema/data/auth semantics, or a broad refactor.
- Client-side title synchronization must remain in-place: no `router.refresh()`, navigation or component remount. A pure helper may translate only metadata titles it can identify safely; an unknown/dynamic title must be preserved.
- Public response hardening is limited to extending the existing route-scoped `/r` response contract to exact `/kiosk` where compatible. No global header policy or deployment configuration change is authorized.

### Frozen source allowlist

Kiosk fixed-Italian and safe public errors:

- `src/app/kiosk/page.tsx`
- `src/features/kiosk/screens/kiosk-screen.tsx`
- `src/features/kiosk/screens/kiosk-screen.test.tsx`
- `src/features/kiosk/model/kiosk-public-error.ts`
- `src/features/kiosk/model/kiosk-session.ts`
- `src/features/kiosk/model/kiosk-session.test.ts`
- `src/features/kiosk/server/kiosk.repository.test.ts` (test-only expected public message update)
- `src/features/kiosk/testing/mock-api.test.ts` (test-only expected public message update)
- `src/app/api/kiosk/pair/route.ts`
- `src/app/api/kiosk/session/submit/route.ts`
- `src/app/api/kiosk/kiosk-routes.test.ts`

Localized 404 and same-document metadata:

- `src/app/not-found.tsx`
- `src/app/r/page.tsx`
- `src/shared/i18n/metadata.ts`
- `src/shared/i18n/locale-provider.tsx`
- `src/shared/i18n/locale-provider.test.tsx`
- `src/shared/i18n/messages.ts`
- `src/shared/i18n/messages.test.ts`
- one new pure helper and focused test under `src/shared/i18n/` when needed for safe document-title synchronization

Bounded public-auth failures:

- `src/features/auth/model/auth-errors.ts`
- `src/features/auth/model/auth-errors.test.ts`
- `src/features/auth/screens/login-screen.tsx`
- `src/features/auth/screens/forgot-password-screen.tsx`
- `src/features/auth/screens/reset-password-screen.tsx`
- `src/features/auth/screens/register-complete-screen.tsx`
- one new focused `register-complete-screen` test
- one new focused public-auth error-state test covering provider failures, focus, field associations and input retention
- existing focused auth screen tests may be modified only when required to prove inline error/focus behavior

CI, audit, route isolation and docs:

- `.github/workflows/ci.yml`
- `playwright.config.ts`
- `scripts/audit-i18n-ui-text.mjs`
- `tests/e2e/i18n-language-switcher.spec.ts`
- `tests/e2e/i18n-orders-queue-release-a.spec.ts`
- one new bounded Kiosk/public-state i18n E2E spec if the existing foundational spec cannot express the acceptance cleanly
- `src/utils/supabase/proxy.ts`
- `src/proxy.test.ts`
- `docs/EMPLOYEE_INTERFACE_I18N.md`
- `docs/I18N_UNTRANSLATED_UI_AUDIT.md`

Task Memory files remain owned by the Integration Lead and are outside the application writer's ownership. `package.json`, lockfiles, `.github/workflows/e2e.yml`, `next.config.ts`, `vercel.json`, `src/proxy.ts`, UI primitives, styles, repositories, services, schemas, migrations and deployment/environment files are forbidden in this release.

### Release 1 acceptance matrix

- Kiosk default/loading/pairing/task/completion/error states use fixed Italian for UI-owned visible text, metadata and accessible names. Dynamic store/customer/device/order/correction content remains original.
- Kiosk validation and stable public-error codes keep the same status/shape and change only the safe display message; device revocation/token clearing and conflict recovery semantics remain unchanged.
- Signature remains optional and pointer-capable; its canvas/clear control has an Italian accessible name/state. No signature-required or keyboard-drawing product change is allowed.
- 404 visible content follows `zh-CN`, `it-IT` or `en`; `/r` renders a single RepairDesk brand; known static page titles update on an in-place locale change while unknown/dynamic titles are preserved; URL, form state, focus and scroll remain unchanged.
- Unknown provider/browser auth errors are replaced with a localized generic safe message. Login/forgot/reset failures have a persistent inline alert in addition to any toast, associate relevant invalid fields where determinable, and preserve entered values. Register Complete shows success only after the status query succeeds; loading, failure, retry and safe return are explicit and localized.
- Expanded audit scans production `.tsx` and `.ts` UI/runtime-error candidates, reports extension/domain counts, keeps legacy/dynamic/customer/legal candidates classified as inventory, and does not impose an invalid whole-repository zero-Han gate. Frozen Release 1 consumers have no unclassified fixed Chinese/English leakage in Italian-only Kiosk states.
- CI runs foundational i18n and Release A/Kiosk coverage on Chromium and WebKit for every pull request and `main` push without path-filter skipping. Missing required mock prerequisites, browser mismatch, server failure, no executed tests or an unexpected skip must fail rather than pass green.
- Six-width evidence covers 390/430/768/1024/1280/1440 for Kiosk, auth failure/retry and 404/metadata representative states; no page-level overflow, long Italian wrapping, keyboard/focus/alert semantics and no real mutation/PII are verified.
- Node 22.12.0 focused tests, full lint/typecheck/test/build, exact-diff QA/security review and `git diff --check` all pass before integration/release.

### Stop and rollback

- Stop for any need to change API response shape, auth/permission/tenant/token/Cookie semantics, schema/data, dependencies/runtime, Vercel settings, secrets, real PII, legal content, signature requiredness, mutation retry, or files outside the frozen contract.
- Stop if automatic required-check status cannot be proven, an E2E needs a non-loopback target, or public headers break Kiosk/login/`/r`/offline behavior.
- Roll back with a normal forward revert. The exact `/kiosk` header slice must remain independently revertible. No force push, Cookie clearing, data rollback or history rewrite.

### Release 1 review-remediation Plan Delta (2026-09-01)

- Independent QA required screen-level proof for real provider failures, alert focus, field associations and retained input. The frozen auth allowlist therefore explicitly includes `src/features/auth/screens/public-auth-error-states.test.tsx`; it is test-only, exercises the already-approved Login/Forgot/Reset behavior, and does not broaden runtime scope.
- The known-title synchronization allowlist now includes the existing `auth.confirmTitle` and `auth.inviteCompleteTitle` catalog keys so those public static pages follow an in-place locale switch. Unknown and dynamic titles remain preserved.
- The final candidate supersedes earlier test counts: after these changes, the full unit suite and both complete Chromium/WebKit i18n matrices must be rerun and recorded before integration.
- The expanded audit's seven `features/kiosk` candidates are classified as employee-side create/review/return validation in `kiosk-session.ts`, not public fixed-Italian leakage; this exception is documented rather than suppressed.

### Release 1 post-push CI Plan Delta (2026-09-01)

- GitHub run `33490561926` proved the no-path-filter matrix executes on `main`: the ordinary verify job passed, while both browser jobs correctly failed instead of reporting green. Controlled artifacts identify timing/determinism gaps rather than an API/data/auth regression.
- The existing E2E allowlist may be tightened only as follows: wait for the final store link instead of assuming a five-second shell load; scope the mobile Quick Order assertion to its mobile quick-start region; make the offline-with-no-cache story abort its queue-summary read so seeded mock data cannot race the intended empty cache.
- The scroll failure exposes a real pointer-order edge in the already-required same-document state contract. `src/components/language-switcher.tsx` and `src/components/language-switcher.test.tsx` are added to the allowlist solely to capture scroll before pointer/keyboard menu opening and prove restoration; locale, Cookie, URL and navigation semantics remain unchanged.
- The same single application writer owns this correction. Required proof is focused component tests, lint/typecheck, both complete 24-story matrices with no skip, then a new normal commit and push. No test retry, skip, timeout-only waiver or CI exception is allowed.

### Release 1 second hosted-CI focus Plan Delta (2026-09-01)

- GitHub run `33492618893` closes the first determinism gaps: ordinary verify and WebKit pass, and Chromium passes 23/24. The sole remaining failure is the same real Orders scroll contract (`240` expected, `0` received) after language selection; the pre-open capture alone did not close the hosted Chromium timing.
- Artifact evidence shows the locale, URL, search, selected row, filters and document identity are all preserved. The language trigger is focused at the top after close, identifying Radix close auto-focus as the remaining scroll source rather than a navigation or component remount.
- The existing two LanguageSwitcher paths remain the only runtime/unit allowlist. The close auto-focus handler may prevent Radix's default focus movement and explicitly focus the same trigger with `{ preventScroll: true }` only for selection/Escape-style closure; outside dismissal must preserve the user's new focus target and native scroll semantics. The existing `tests/e2e/i18n-language-switcher.spec.ts` may add only this real-browser outside-dismiss assertion. No existing E2E assertion, timeout, retry, skip, locale/Cookie/navigation semantic or application boundary may change.
- Required proof is the focused component suite, full static/unit/build gates, both complete 24-story browser matrices with zero skips, a new independent QA/security check, and a new exact-SHA hosted run where verify, Chromium and WebKit all pass. The READY Vercel deployment for `6a7bcdb8...` is superseded for release acceptance while Chromium is red.

### Release 1 milestone result (2026-09-01)

- Status: COMPLETE and production observed at exact SHA `7d1b59c5e8e61b654beb329444ec1fef03cda2c3`.
- GitHub Actions run `33495161684` is green: verify, Chromium and WebKit all completed successfully; no red run was retried or waived.
- Vercel deployment `dpl_F8qQS27LxRAHVw3a7m3Dg9FBFPqq` is READY on `www.chinatech.in`, `chinatech.in` and the existing project aliases. Public read-only smoke confirms canonical redirects, localized login/Kiosk/`/r`, exact Kiosk scoped headers and no deployment error logs in the observed window.
- Rollback anchor for this milestone is the immediately preceding READY production deployment `dpl_14EobMtRCtWpQpW3DugU8oD4xYEm` at `6a7bcdb8...`; earlier pre-Release-1 anchor `dpl_AP6Y4eDmFgukeS4boDjDtqsNEJY3` at `8e349b06...` remains available.
- Release 2 employee deep-interface translation and Release 3 dependency/runtime/observability/governance work remain open and require separately frozen goals. Release 1 completion must not be described as full reachable-interface translation completion.

## Release 2A Scanner/Camera shell frozen change contract (2026-09-01)

### Decision

- This milestone translates the production-reachable Scanner/Camera shell and its immediate Order QR, scan-search and attachment-draft result surfaces. It is a bounded employee-interface batch, not a claim that all deep Orders pages or all reachable UI are translated.
- Three independent read-only reviews (Product/UX, Architecture/Security and QA) found no P0 and agreed that `ImeiScannerField` is a separate business component: its OCR/barcode/Luhn/device-preference behavior and large existing test surface are explicitly excluded from this batch.
- Order QR keeps `scanMode="qr-only"` and `parseOrderQrPayload`; IMEI, SN, EID, EAN, SKU, arbitrary text, external URLs and non-order QR input remain rejected. Protected customer-status credentials must never appear in DOM, toast, copy, search, logs or screenshots.
- Dynamic customer/order/device/file/user input and raw scan values remain original. Known UI-owned payload labels, kinds, validation issues and search actions are translated only at the presentation boundary; routing, deduplication, action IDs, hrefs, search values, primary selection and protocol values remain identical across locales.
- Camera copy becomes truthful about persistence context: the default is a local draft, while the two existing Order Detail camera entry points may select an `order-attachment` copy variant. This does not add upload, persistence or mutation behavior.

### Frozen source allowlist

- `src/shared/i18n/messages.ts`
- `src/components/lazy-modal-shell.tsx`
- `src/features/capture/components/barcode-scanner-sheet.tsx`
- `src/features/capture/components/camera-capture-sheet.tsx`
- `src/features/capture/components/scan-search-button.tsx`
- `src/features/capture/components/attachment-draft-panel.tsx`
- `src/features/capture/model/scanner-errors.ts`
- `src/features/capture/model/scan-search-resolver.ts`
- `src/features/capture/model/attachment-rules.ts` only for a structured validation issue while retaining existing rules and formatter compatibility
- one small presentation-only helper under `src/features/capture/model/` when needed for payload label/kind/validation copy
- `src/features/orders/components/order-qr-scanner.tsx`
- `src/features/orders/screens/order-detail-screen.tsx` only at the two existing Camera caller sites, to select the semantic `order-attachment` copy variant
- `.github/workflows/ci.yml` only to add the required Release 2A i18n browser spec
- `docs/EMPLOYEE_INTERFACE_I18N.md`
- corresponding existing focused tests; new focused `attachment-draft-panel`, `lazy-modal-shell` and presentation-helper tests; `src/shared/i18n/messages.test.ts`; relevant order-boundary tests test-only; one new `tests/e2e/i18n-scanner-camera-shell.spec.ts`

Task Memory remains Integration Lead-owned. `MobileWorkspaceDock` is expected to consume the default local-draft camera copy without a source change; if implementation proves otherwise, it is a stop condition for a documented Plan Delta.

### Forbidden boundaries and non-goals

- Do not modify `src/features/capture/model/barcode-parser.ts`, `src/features/orders/model/order-qr-payload.ts`, `src/entities/customer-status/model/customer-status-link.ts`, `src/components/imei-scanner-field.tsx`, `src/features/capture/model/scan-intent.ts`, UI primitives, styles, APIs, repositories, query keys, permissions, upload payloads, schema, migrations, dependencies, environment or deployment configuration.
- Do not translate raw/canonical/dynamic business data in parsers or persisted payloads. Do not expose raw media/API error messages; classify stable error kinds and map them to safe localized display copy.
- Do not broaden Order Detail translation beyond the two camera copy-variant callers, add a route, change mutation behavior, require physical camera access for tests, or weaken/skip/retry a required browser story.

### Acceptance matrix

- `zh-CN`, `it-IT` and `en` cover Scanner/Camera titles, descriptions, preparing/starting/active/paused/image-recognition/error states, QR-only boundary copy, manual-entry label/placeholder/action, recognized/protected/original-content/result actions, Camera preview/capture/retake/use-photo/album copy, lazy load failure/cancel/retry, five scan-search scopes and their action hints, validation/file/paste/copy/image timeout/decode states, attachment-draft kinds and truthful draft/order-attachment context.
- Error handling uses stable codes/kinds rather than localized-message matching. A secret-like raw camera error is absent from rendered UI/toasts. Camera has a persistent safe recovery state, accessible status/alert semantics and an accessible video label.
- Scanner and Camera pass localized `closeLabel`; manual barcode input has an accessible label; close/Escape restores each existing trigger with `{ preventScroll: true }`; outside dismissal preserves the user's target. Locale switching does not restart media or clear manual/result state.
- Camera pause/restart and primary mobile targets remain at least 44px; Sheet owns its scroll, respects safe area, long Italian wraps, last options/actions remain reachable and neither page nor Sheet overflows.
- Chromium and WebKit cover all six widths: 390x844, 430x932, 768x1024, 1024x768, 1280x800 and 1440x900. The required matrix is 3 locales x 6 widths x 2 engines (36 proof points), with Italian screenshots at every width and representative Chinese/English screenshots at 390/768/1440.
- Browser fixtures use deterministic camera/scanner fallback, no physical device, production login, PII or mutation. They assert boundary invariants, focus/Escape/scroll, locale persistence, no console/page errors and no credential/raw-error leakage.
- Node 22.12.0 focused tests, full lint/typecheck/test/build, exact-diff checks and independent final QA/Security review must pass with no unresolved P0/P1 before integration.

### Stop and rollback

- Stop for any parser/QR-token/IMEI business-rule, API/payload/permission/tenant/query/schema/data/dependency/env/UI-primitive change, any production/customer data requirement, an ambiguous dirty path or inability to keep action outputs locale-invariant.
- Stop if locale changes restart media, result data is lost, a credential/raw error can leak, required browser coverage must skip, or a physical camera/real mutation is needed for proof.
- Roll back through a normal forward revert of this bounded milestone. No force push, data rollback, environment change or history rewrite.

### Release 2A MobileWorkspaceDock key-isolation Plan Delta (2026-09-01)

- Real Chromium evidence proved the existing conditional Scanner and Camera lazy panels remain mounted after sequential use and both render sibling `LazyModalErrorBoundary` elements with numeric key `0`. Opening Camera after Scanner therefore emits React's duplicate-key warning even when the safe Scanner/Camera error toasts are deduplicated and use distinct stable IDs.
- `src/components/mobile-workspace-dock.tsx` is added to the source allowlist only to namespace the existing attachment, scanner and camera lazy-boundary keys by panel type plus their unchanged loader version. No action order, mount/open state, route, focus, payload, permission, draft or retry behavior may change.
- Required proof is the existing focused MobileWorkspaceDock tests plus the staged zero-console Scanner→Camera browser journey. Rollback is the one-file key-prefix revert. Any need beyond key identity remains a stop condition.

### Release 2A WebKit explicit global-scanner opener Plan Delta (2026-09-01)

- The first complete WebKit run passed 36/45 stories and failed only the nine desktop Escape-focus assertions. Chromium passed the same complete 45/45 matrix. Evidence identifies the failing control as the global AppBar scanner trigger, whose controlled `ScanSearchSheet` is mounted by Providers without a Radix `SheetTrigger` relationship.
- Safari/WebKit does not make a clicked button `document.activeElement` by default, so the scanner sheet cannot infer the global opener from ambient focus even though Chromium can. This is a real cross-browser accessibility defect; the assertion, timeout and acceptance requirement remain unchanged.
- `src/components/app-bar.tsx` is added to the source allowlist only to focus its existing scanner button synchronously with `{ preventScroll: true }` before invoking the unchanged `onOpenScanner` callback. No prop shape, layout, route, command, scanner, parser, state, navigation or permission behavior may change.
- Required proof is focused AppBar/Scanner tests, one Chromium and one WebKit desktop Escape-focus journey plus the complete final matrices. Outside dismissal must still preserve the outside target, and the existing mobile flow must remain unchanged. Rollback is the one-handler focus line; any need to change Providers, CommandPalette or another trigger is a new stop condition.

### Release 2A final-review Camera focus, toast and state-evidence Plan Delta (2026-09-01)

- Independent final QA and Security review blocked release because the controlled Camera Sheet did not yet share Scanner's close-auto-focus/outside-dismiss contract. MobileWorkspaceDock unconditionally restored its trigger with plain `focus()`, Order Detail did not preserve the exact photo opener, and the browser story closed Camera without proving either behavior. This violates the frozen acceptance; it is not waived.
- `src/features/capture/components/camera-capture-sheet.tsx` may add the same bounded `onCloseAutoFocus` and `onOutsideDismiss` presentation hooks already used by Scanner, and must dismiss only its own stable Camera error toast on restart, close and unmount. It may not change capture, file, draft, upload, permission or payload behavior.
- The existing `src/components/mobile-workspace-dock.tsx` Plan Delta expands only to coordinate Camera/Scanner Escape/programmatic close with `focus({ preventScroll: true })`, remove unconditional close refocus and preserve outside dismissal without stealing focus. Lazy-fallback cancel may explicitly restore the existing Dock trigger with `preventScroll`; no action, navigation or panel-state semantics may change.
- `src/features/orders/screens/order-detail-screen.tsx` may add refs/state-machine callbacks only around its already-approved desktop/mobile photo triggers and two Camera callers. `src/features/orders/components/order-overview-tab.tsx` is added solely to pass the actual existing photo button `currentTarget` through its existing `onCapture` / `onPhotoCapture` callbacks; no layout, copy, upload, permission or business behavior may change.
- Final QA also identified the only other direct controlled production Scanner caller, `src/features/dashboard/components/dashboard-quick-start.tsx`. It is added solely to retain its existing scan-order button as an explicit opener and coordinate Escape/programmatic close with `focus({ preventScroll: true })` while preserving outside dismissal. Its links, action order, copy, layout, route and Scanner scope remain unchanged; corresponding existing focused tests may be extended.
- Existing focused tests must directly cover too-long input; paste/copy success and failure; invalid/oversized images; image timeout/decode failure; Camera toast dismissal; Camera Escape focus with `preventScroll`; and outside-dismiss no-forced-refocus. The required E2E must remove the Sonner pointer-event DOM mutation, wait for Scanner/Camera-owned toasts to dismiss naturally, prove mobile and Order Detail Camera Escape focus in Chromium/WebKit, and add a real overlay outside-dismiss branch that does not refocus the trigger or move scroll.
- Browser log proof must inspect every captured console level for protected token and raw camera error absence while retaining the zero console-error/page-error and mutation-abort gates. Assertions, timeouts, retry/skip policy and QR/credential/parser boundaries may not be weakened. Required proof is focused tests, final full Node gates, both complete browser matrices and renewed independent QA/Security with no P0/P1.
- The final browser matrix must actually exercise Camera in all six widths for all three locales: Dock at 390/430, the existing Order Detail compact photo entry at 768, and the existing Order Detail desktop photo entry at 1024/1280/1440. The 768 Dock is intentionally absent because its existing shell is `md:hidden`; this evidence correction does not authorize a layout change. A deterministic local image journey must additionally prove Camera album/use-or-confirm behavior and the localized AttachmentDraft result without a real upload. Component tests must prove capture/preview/retake/use-photo, all five scan-search scopes across three locales and locale-invariant action outputs. This may add stories/assertions to the same approved E2E without reducing any existing story.

### Release 2A CommandPalette stable global-scanner opener Plan Delta (2026-09-01)

- Renewed Architecture/Security review identified that CommandPalette is an additional production opener for the Providers-controlled global `ScanSearchSheet`. Its selected `CommandItem` is removed when the palette closes, so ambient opener capture points at a detached node and cannot satisfy the frozen exact-trigger focus contract. The earlier statement that Dashboard was the sole additional controlled caller is superseded; this P1 is not waived.
- `src/app/providers.tsx` is added only to own one stable ref for the already-existing AppBar global-scanner button. After CommandPalette requests Scanner, Providers must let the palette close, then on the next animation frame focus that stable AppBar button with `{ preventScroll: true }` before opening the unchanged global Scanner. The AppBar button is the deterministic accessible fallback because the CommandItem no longer exists. No command order, label, route, scanner scope, navigation, query, permission or panel behavior may change.
- `src/components/app-bar.tsx` may accept the Providers-owned optional button ref and attach it to the same existing Scanner button; the already-approved direct AppBar click behavior remains unchanged. `src/components/app-bar.test.tsx` and the existing Scanner/Camera E2E may extend proof. `src/components/command-palette.tsx` must remain unchanged unless a new blocker is proven.
- Required proof is focused AppBar behavior plus a real Chromium and WebKit desktop CommandPalette → global Scanner → Escape journey: the palette is gone, Scanner opens once, scroll is unchanged, and close returns focus to the existing AppBar Scanner button with the final recorded focus call using `preventScroll`. Existing outside-dismiss no-refocus behavior, all prior stories and zero mutation/page-error/console-error/token/raw-error gates remain unchanged. Any need to change routing, command semantics, Providers hierarchy or Scanner business behavior is a new stop condition.
- The same E2E must prove both production CommandPalette openings: its visible shell/search trigger and the existing keyboard shortcut. For either path, the deterministic post-Scanner target is the same stable AppBar Scanner button because the selected CommandItem is intentionally unmounted. Final Scanner screenshots must wait for the Scanner-owned toast to disappear naturally and for the target Sheet to settle before capture; test code may not mutate or hide toast/overlay DOM. The final evidence set must contain no fading Scanner or Camera toast residue.

### Release 2A malformed protected-credential fail-closed Plan Delta (2026-09-01)

- Final Architecture/Security review proved a release-blocking pre-existing edge case in the production Order QR path: `parseOrderQrPayload` classifies a malformed customer-status URL that still contains a valid bearer token as ordinary invalid text with the original `raw` value. `BarcodeScannerSheet` then renders `value || raw`, so the token can enter the DOM even though exact valid customer-status links are protected. This violates the frozen Release 2A credential boundary and is not waived merely because the parser predates this batch.
- The allowlist expands only to `src/features/orders/model/order-qr-payload.ts`, its existing focused test, the already-approved `src/features/orders/components/order-qr-scanner.test.tsx`, and the existing Release 2A E2E. No capture parser, customer-status entity parser, UI component, route, permission, API, query, payload, schema, data, dependency or environment behavior may change.
- `parseOrderQrPayload` must fail closed for every customer-status candidate that is invalid or contains an exact legacy/stable bearer token: return `kind="customer_status_link"`, `sensitive: true`, empty `raw` and `value`, no `targetHref`, and the existing invalid protected-label state. A valid customer-status target may retain only its existing internal `targetHref`; its `raw` and `value` must also be empty. Ordinary non-sensitive invalid Order QR values retain the existing invalid-text behavior.
- Candidate detection may conservatively inspect delimiter-separated exact legacy/stable token segments only to prevent a parser-error bypass; it must not accept a new customer-status link, create a search action or navigate. Existing exact order QR acceptance, `qr-only` decoding, `parseCustomerStatusLink` trust rules and Order detail routing remain unchanged.
- Required proof includes parser tests for trusted query/path variants, scheme-relative and lookalike hosts, credentials/ports, malformed URL syntax with a valid token, standalone/stable tokens and ordinary invalid values; wrapper/component proof that no target action is offered; and real Chromium/WebKit Order QR journeys in Chinese, Italian and English asserting the token is absent from DOM/accessibility text/clipboard/console and no mutation/navigation occurs. All prior assertions remain, then full Node gates and both complete browser matrices must be rerun before renewed independent review.
- Rollback is a scoped forward revert of this parser/test delta. Any need to change the shared customer-status parser, valid-token contract, route, scanner component, navigation or persisted data is a new stop condition.

### Release 2A deterministic CommandPalette return-focus Plan Delta (2026-09-01)

- The final post-credential Chromium matrix and a five-run isolated diagnostic proved a real intermittent race in the existing CommandPalette → global Scanner handoff: the single animation-frame focus occurs before Scanner opens, but concurrent rendering can let CommandPalette close-auto-focus replace `document.activeElement` before `ScanSearchSheet` captures its ambient opener. The isolated journey failed once and passed four times, so neither a retry nor the earlier ambient-focus proof is accepted.
- The stable AppBar Scanner button remains the same logical destination. `src/features/capture/components/scan-search-button.tsx` may accept one optional controlled return-focus ref and prefer that element only for Escape/programmatic close; its existing ambient opener remains the fallback for every other caller. Outside dismissal must still preserve the user's target and must not force the controlled ref. `src/app/providers.tsx` may pass its existing AppBar Scanner ref to the existing global `ScanSearchSheet`. No hierarchy, command order, route, scanner scope, query, navigation, permission or business behavior may change.
- The corresponding existing `scan-search-button` test and the existing Scanner/Camera E2E may extend proof. The component test must prove controlled-ref preference, ambient fallback and outside-dismiss no-refocus. The real-browser visible and keyboard CommandPalette journeys must each close back to the stable AppBar button with final `{ preventScroll: true }`, unchanged scroll and exactly one Scanner instance in both Chromium and WebKit.
- Required proof is a repeated isolated race diagnostic on the corrected tree, target lint/typecheck/focused tests, complete Chromium/WebKit matrices without retry/skip/waiver, then full Node/build gates if source changes after their latest run and renewed independent QA/Security. Rollback is the optional ref prop/pass-through plus focused proof. Any need to change CommandPalette, Radix primitives, global layout, APIs or data is a new stop condition.

### Release 2A global Scanner protected-credential parser Plan Delta (2026-09-01)

- Renewed Architecture/Security review proved the Order QR correction did not cover the separate production global Scanner. `ScanSearchSheet` still uses the shared `parseBarcodePayload`; standalone legacy credentials are currently classified as ordinary serials, while standalone stable and malformed parser-error credentials can become ordinary text. The result surface can render/copy them and `resolveScanSearchActions` can propagate them into four search actions. This is a release-blocking P1 and supersedes E-029.
- The allowlist expands only to `src/features/capture/model/barcode-parser.ts`, its existing test, `src/features/capture/model/scan-search-resolver.test.ts`, the existing `src/features/capture/components/barcode-scanner-sheet.test.tsx` when needed for presentation proof, and the existing Release 2A Scanner/Camera E2E. The shared customer-status entity parser, IMEI component/candidate extraction, scan intent, UI primitives, routes, APIs, permissions, query/payload/data/schema/dependency/configuration remain unchanged.
- Before generic IMEI/serial/URL/text classification, the shared capture parser must recognize the existing valid customer-status token/link contract and fail closed for any invalid or parser-error value containing an exact delimited legacy/stable token. Valid results retain only the existing internal `/r#...` target; invalid results have no target. Both use `kind="customer_status_link"`, `sensitive: true`, empty `raw` and `value`. Ordinary serials, IMEIs, URLs, text and 44-character token lookalikes retain their existing behavior.
- `resolveScanSearchActions` must produce no search/open action for an invalid protected payload and may produce only the existing safe internal open action for a valid protected target; no action, label, href, query or search value may carry the token except that valid internal target. The result surface must not render/copy the token.
- Required proof includes shared-parser tables for standalone valid legacy/stable credentials, malformed trusted/lookalike/parser-error and dot prefix/suffix cases, ordinary identifier regressions and 44-character lookalikes; resolver/action proof; Scanner component proof; and a real global Scanner journey in Chromium and WebKit asserting no token in DOM/attributes/input/accessibility tree/clipboard/console, no invalid protected action/navigation/write and unchanged valid safe-target behavior. No existing assertion may be weakened. Repeat focused/full Node/build and complete browser gates, then renew both independent reviews before integration.
- Rollback is a scoped forward revert of this capture-parser/test delta. Any need to change customer-status entity parsing, IMEI/device recognition, public `/r`, APIs, permissions, data or persisted payloads is a new stop condition.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
- The phrase “language switching complete” remains separate from “full reachable fixed UI translated”; the final claim must be backed by the final classified audit and browser evidence.
