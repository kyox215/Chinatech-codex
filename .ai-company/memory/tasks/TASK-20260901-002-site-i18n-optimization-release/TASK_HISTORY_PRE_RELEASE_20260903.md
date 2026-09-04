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
updated_at: "2026-09-03T20:30:00Z"
---
# Task — 按优化报告完成高优先级网站与三语改进并发布

## Owner request

- 按 2026-09-01 项目/网站/语言审计报告开始执行优化目标。
- 完成后正常推送 `main` 并部署现有生产网站。

## Superseding lightweight i18n restart contract — 2026-09-03

This section supersedes the broader execution, review and release scope below for all remaining work. Historical completed evidence remains valid, but it does not authorize new non-i18n remediation.

- **Scope:** Chinese/Italian/English translation coverage, locale switching, i18n metadata/output/parity, responsive or accessibility defects caused directly by localized text, and targeted tests.
- **Remaining page groups:** Memos, Toolkit, Platform and AI client presentation. Work them as one related four-group i18n batch.
- **Non-goals/backlog:** permissions or capabilities, Finance/Toolkit/Platform/Memos business logic, order workflow, cache architecture, AI behavior/API/tool contracts, protocol idempotency, unrelated security/refactor work and dependency/runtime/release engineering.
- **Acceptance:** no intended fixed locale string/fallback gap in the changed scope; dynamic values and canonical data stay byte-stable; locale switching and affected responsive/a11y flows work; one targeted validation for the batch and one QA pass per completed module.
- **Blocking:** only an evidenced P0, or an evidenced P1 that directly makes this i18n acceptance fail. Range-external, theoretical and P2/P3 findings are recorded as backlog and do not expand or block this task.
- **Coordination:** one owner maintains Done/Remaining/Blocked/Next/evidence. Reviewers may provide evidence and severity recommendations but cannot expand scope or reset a passing baseline without a relevant state/risk change.
- **Release:** do not commit, push, deploy, run remote SQL or apply production migrations. After the final single i18n verification, deliver a release-ready handoff and request a separate Owner release decision.

The previously recorded authorization for shared authority-cache changes, Platform business-action removal and AI server behavior is superseded and no longer executable in this task. The already completed Memos Rome Delta remains historical local work; no further Memos business/security/idempotency expansion is allowed.

### Lightweight restart closeout

- **Done:** Memos, Toolkit, Platform and AI client fixed presentation; all previously completed employee i18n batches remain accepted.
- **Remaining in this task:** none for direct i18n implementation. Release is a separate Owner decision.
- **Blocked:** no direct-i18n P0/P1. The final browser story is conditional because two non-i18n P2 focus-return assertions stopped Platform/AI before every trailing browser assertion completed.
- **Next:** keep the P2 focus issue in the project backlog; request a separate integration/push/deploy decision. Do not release from this conditional task state.
- **Evidence:** E-091 through E-093 and `CEO_REPORT.md`.

### Separate release approval — 2026-09-03

- **Owner decision:** `批准`, in direct response to the requested separate release decision for the current i18n candidate.
- **Authorized:** resolve the exact candidate scope, acquire and verify the integration lease, run proportional final gates, create normal commit(s), non-force push `main`, deploy the existing Vercel production project, verify the exact SHA/canonical domains and record rollback evidence.
- **Not authorized:** database/schema/migration, environment or secret changes, production/customer data writes, force push, unrelated project-health files, or new product/business remediation.
- **Stop conditions:** unresolved candidate ownership, origin/main divergence that cannot be reconciled safely, direct-i18n P0/P1, failing required hosted exact-SHA gate, Vercel deployment not READY, canonical smoke failure, or inability to identify a prior READY rollback anchor.

## Business value

完成审计报告中的高优先级客户语言、回归门禁和网站可靠性改进，并安全发布到 main/生产

## Milestone status

- Release 1 complete and production accepted at `7d1b59c5e8e61b654beb329444ec1fef03cda2c3`.
- Release 2A Scanner/Camera plus adjacent Orders fixed-UI localization complete and production accepted at `5edab21d75c540cd16b32e87683edb1d72a7a5dd`; hosted run `33560282833` and deployment `dpl_6eEWtvZQAGw1JSkXeX9gDAuyuUdp` are green/READY.
- The broad task remains active for Release 2B employee domains and Release 3 reliability/governance; Release 2A completion is not a claim that every reachable fixed UI string is translated.

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

### Release 2A hosted WebKit capacity-timeout Plan Delta (2026-09-01)

- Exact-SHA hosted run `33556608348` passed verify and Chromium, but WebKit passed 38/46 and failed eight Scanner/Camera width cases at the unchanged global 30-second per-test limit. The failing cases completed 30.9–31.6 seconds while the same journey took about 20–30 seconds in passing hosted cases; captured failure images show the expected localized Camera Sheet and safe permission state, with late failures occurring at natural toast removal, geometry settlement, close or action-stability assertions. This is a real CI capacity/determinism gate and is not waived or retried.
- The corrective allowlist is test-only: `tests/e2e/i18n-scanner-camera-shell.spec.ts` may assign a 60-second timeout only to the generated 18-case Scanner/Camera matrix. No expectation timeout, assertion, action, wait helper, retry/skip/only policy, application source, CI job timeout or workflow command may change. The 60-second budget is derived from the observed maximum 31.6-second hosted case and keeps every existing assertion intact.
- Required proof is an exact focused diff, local WebKit and Chromium full Scanner/Camera spec without retry/skip/waiver, targeted test/lint/typecheck checks, renewed independent QA plus Architecture/Security no-P0/P1 review, then a separate normal corrective commit and push. The new exact SHA must pass hosted verify, Chromium and WebKit and produce a same-SHA READY Vercel deployment before production acceptance.
- Rollback is the one test-timeout line. If any assertion still fails within the increased per-case budget, or evidence reveals an application, toast, focus, geometry or route defect, stop and correct the underlying behavior instead of increasing the timeout again.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
- The phrase “language switching complete” remains separate from “full reachable fixed UI translated”; the final claim must be backed by the final classified audit and browser evidence.

## Release 2B-1 Orders New + Task frozen change contract (2026-09-02)

### Decision and scope

- Release 2B executes in this fixed order: 2B-1 Orders New + Task; 2B-2 Order Detail; 2B-3 Customers; 2B-4 current Inventory Products/Lifecycle; 2B-5 current Transparent Buyback; 2B-6 Settings Core plus Messages/Finance/Memos/Toolkit/Platform/Account/AI. Only 2B-1 is authorized in this packet.
- 2B-1 covers production-reachable employee UI on `/orders/new`, the existing New Order dialog opened from `/orders`, and `/orders/[id]/task`: fixed titles, labels, help, placeholders, ARIA, validation, loading/empty/error/permission/offline/conflict/pending/success states and safe employee-facing errors in `zh-CN`, `it-IT` and `en`.
- Locale is presentation-only. Customer/store/staff/device names, phone, IMEI, order number, issue/diagnosis/accessory/custom text, custom workflow labels and unknown values remain original. Canonical status/code/kind/action/query/payload/idempotency values, permissions, cache keys and URLs remain byte-equivalent across locales.
- Fixed `zh-CN` offline-draft time display must use the shared locale-aware formatter with the existing Europe/Rome time zone. The fixed `zh-CN` brand/model sorting policy is recorded as a stable ordering exception and does not change in this batch.
- Raw provider/API/storage errors must not be rendered. Known display failures may be mapped at the presentation boundary; unknown failures use safe generic localized copy without changing API shapes or mutation behavior.

### Frozen production allowlist

- Shared presentation: `src/shared/i18n/messages.ts`; `src/features/orders/model/order-i18n.ts`.
- New Order: `src/features/orders/screens/new-order-screen.tsx`; `src/features/orders/forms/new-order-customer-device-section.tsx`; `src/features/orders/forms/new-order-quotation-section.tsx`; `src/features/orders/forms/new-order-guided-workspace.tsx`; `src/features/orders/forms/new-order-submit-bar.tsx`; `src/features/orders/forms/customer-intake-lookup.tsx`; `src/features/orders/forms/customer-identity-results.tsx`; `src/features/orders/components/device-unlock-fields.tsx`; `src/features/orders/components/accessory-notes-picker.tsx`; `src/features/orders/components/order-workspace-primitives.tsx`; `src/components/orders/fault-diagnosis-picker.tsx`; `src/components/orders/phone-keypad-input.tsx`; `src/components/orders/money-keypad-input.tsx`; `src/components/navigation-guard-provider.tsx`.
- Task: `src/features/orders/screens/order-task-screen.tsx`; `src/features/orders/components/order-workflow-progress.tsx`; `src/features/orders/components/order-transition-reason-selector.tsx`; `src/components/orders/diagnosis-quote-dialog.tsx`.
- No new production component is expected. `order-i18n.ts` may gain pure presentation adapters keyed by stable IDs/codes; it may not infer persisted values from localized text.

### Test and CI allowlist

- Existing focused tests corresponding to the frozen consumers may be extended, including `src/shared/i18n/messages.test.ts`, `src/features/orders/model/order-i18n.test.ts`, the New Order form/component tests, keypad/unlock/navigation-guard tests and Task workflow/diagnosis/transition tests.
- Add `src/features/orders/screens/new-order-screen.i18n.test.tsx`, `src/features/orders/screens/order-task-screen.i18n.test.tsx`, focused missing component tests where required, and `tests/e2e/i18n-orders-new-task-release-2b1.spec.ts`.
- `.github/workflows/ci.yml` may change only to include the new 2B-1 browser spec in the existing Chromium/WebKit i18n release gate. No retry, conditional skip, timeout-only waiver or weakened assertion is permitted.

### Forbidden boundaries and registered exceptions

- Printing/customer documents are excluded: no print sheet, paper dialog, PDF-ready dialog, print portal/hook/PDF implementation, `order-italian.ts`, print body, warranty term, notification body or customer message content change. In `order-task-screen.tsx`, print mutation/data flow remains unchanged; only adjacent employee chrome may be localized when it does not alter document output.
- Scanner/Camera and IMEI recognition are excluded, including `imei-scanner-field.tsx`, capture parsers and OCR. The warranty subtree, `order-warranty.ts`, persisted default `"6个月"`, repair service catalog data and all customer/legal content remain unchanged. Their fixed/dynamic strings are classified exceptions, not a zero-Han target.
- No API/client/repository/query/payload/permission/capability/cache invalidation/model/schema/migration/dependency/environment/data change. New Order create payload and Task transition/patch/quote/Kiosk/WhatsApp values are frozen. Transition reasons, accessory values and repair service values remain canonical/original even when their employee display labels are localized.
- `NavigationGuardProvider` is a shared consumer; any edit must preserve every non-New-Order behavior and pass its full focused suite. If implementation requires changing a forbidden file or cannot prove locale-invariant payloads, stop and open a Plan Delta.

### Acceptance and release gate

- Catalog key/token parity and non-empty values are 100% for all three locales. In the frozen employee-owned regions, Italian and English contain zero unclassified fixed Chinese; dynamic data and registered exceptions are explicitly excluded from that check.
- Screen/component tests cover default, selected-customer/device, validation/focus/ARIA, permission/readonly, every offline-draft state, identity conflict, pending/success, timeout recovery/uncertain/error, dirty-leave, Task loading/not-found/read-error, finance restriction, diagnosis/quote, Kiosk and transition states. Three-locale requests must retain deep-equivalent canonical payloads after normalizing only generated UUIDs, and retries must reuse the same operation ID.
- Browser coverage includes `/orders/new`, the `/orders` New Order dialog and `/orders/<fixture>/task`. The core matrix is 3 locales x 6 widths (390/430/768/1024/1280/1440) x 2 engines x 2 primary screens = 72 proof points. Each checks lang, core labels/actions/accessibility, no page overflow, reachable actions, scoped fixed-Han absence, zero page/console error and zero unexpected mutation. Italian screenshots cover all six widths; representative Chinese/English screenshots cover 390/768/1440.
- Heavy states run in both engines at least at Chinese 390, Italian 768 and English 1440. Locale switching preserves URL, draft, identity association, dynamic values, focus/scroll, pending lock and canonical body. Tests use deterministic local fixtures only, `retries: 0`, no `skip/fixme/only`, `--forbid-only --fail-on-flaky-tests`, and report zero skipped/flaky/expected-failed cases.
- Node 22.12 focused tests plus full lint, typecheck, test and build must pass. Independent QA and Architecture/Security review must report P0=0 and P1=0 before integration. Final project release still requires exact-SHA hosted verify/Chromium/WebKit, READY same-SHA Vercel deployment, read-only production smoke and a recorded rollback anchor.

### Rollback and stop conditions

- Roll back this milestone only by a normal forward revert of the bounded catalog/consumer/test/CI delta; no data or environment rollback is expected.
- Stop for any locale-dependent payload, permission or navigation change; persisted localized value; raw error/credential disclosure; customer/legal/print/warranty body change; required physical device or real mutation; conditional browser skip; ambiguous dirty ownership; or unresolved P0/P1.

### Release 2B-1 first-browser Plan Delta (2026-09-02)

- The first real Chromium matrix passed 14/18 and failed closed. At 768px the responsive New Order dialog intentionally exposes the localized bottom `backOrders` action while both its mobile `<md` and desktop `lg+` close headers are absent; the E2E must assert the real viewport-specific action instead of requiring a nonexistent close button. No timeout, retry, skip or product layout change is authorized for this failure.
- The same accessibility snapshot exposed a genuine missed production consumer: `src/features/orders/components/new-order-dialog.tsx` still supplied fixed-Chinese hidden `DialogTitle`, `DialogDescription` and Suspense loading copy. Add only that component and a focused test to the allowlist, localize its employee accessibility/loading chrome, and change no Dialog lifecycle, lazy-loading, focus or callback behavior.
- The screenshot also showed fixed-Chinese repair category labels and their ARIA strings from the catalog-backed `FaultDiagnosisPicker`. Its already-approved source plus `order-i18n.ts`, `messages.ts` and `src/features/orders/components/order-option-pickers.test.tsx` may add presentation adapters keyed only by stable group/option/catalog keys. Selected `categoryKey`, `catalogKey`, `categoryLabel`, `name`, note and submitted repair item objects must remain byte-equivalent; unknown/custom values remain original.
- Persisted warranty text/default labels and IMEI Scanner copy remain registered exclusions. This Delta does not authorize `warranty-picker.tsx`, repair catalog data/model, Scanner/Camera/IMEI, API, payload, permission, query, schema, dependency, print/customer output or layout changes.
- After correction, rerun focused tests, target lint/typecheck and the complete Chromium 18/18, then WebKit 18/18. The one 1440px navigation timeout is not accepted as evidence of a timeout-policy need; rerun after the deterministic assertion/UI correction and diagnose any recurrence before considering a separate Delta.

### Release 2B-1 independent-review remediation Delta (2026-09-02)

- The first final QA and Architecture/Security reviews failed closed with P0 = 0 and P1 = 2. The default-state core matrix, 48 screenshots and full Node/build gates remain useful evidence, but they do not authorize closing 2B-1.
- P1-01 is architectural: `localizeOrderTaskGuidance` may not infer semantics from Chinese `label`, `task`, `nextAction` or other display strings. Extend the allowlist to `src/features/orders/model/order-task-flow.ts` and its focused test solely to add an explicit stable guidance discriminator for the existing branches (`cancelled`, `approval_overdue`, `device_with_customer`, `pickup_overdue`, `mail_in_progress`, `repaired`, `stage`). `order-i18n.ts` must select message keys only from that discriminator and the existing `stage.key`; changing the Chinese source wording or colliding custom text must not affect classification. No persisted model, API contract or workflow behavior changes.
- P1-02 is missing dynamic evidence: extend only the two new screen i18n tests, their directly related focused component tests and `tests/e2e/i18n-orders-new-task-release-2b1.spec.ts`. The component/integration harness must exercise all three locales and prove normalized deep equality for actual Create, Transition, Diagnosis Patch, Quote Publish and Kiosk inputs; canonical accessory/reason/repair/custom values remain original. A Create timeout must confirm status with the exact `operation_id` already sent, without a duplicate Create; Quote retry must reuse the same caller-owned idempotency key.
- The state matrix must add concrete localized evidence for New Order selected customer/device, validation/focus/ARIA, finance permission/readonly, local-draft scope/checking/ready/saving/saved/queued/error/unavailable/disabled, restore/discard, shared/separate identity conflict, create pending/success, timeout confirming/uncertain/retry, safe known/unknown error and dirty-leave save/discard. Task evidence must cover loading/not-found/read-error, finance redaction, permission combinations, diagnosis, quote, Kiosk unavailable/pending/success/error and transition optional/required reason/conflict/error. Existing focused tests may be cited only when their assertions exercise the current localized presentation or canonical runtime value; test names alone are not evidence.
- In both Chromium and WebKit, add deterministic heavy-state journeys at Chinese 390, Italian 768 and English 1440. Exact API routes may be locally intercepted and fulfilled to observe inputs without a real write; no production host, credential, external data or persistent mutation is allowed. At least one in-place language switch must preserve URL, same-document identity, populated draft, selected identity/dynamic values, focus, scroll, pending lock and captured canonical request body. The browser error/request gate stays fail-closed; no wait-only waiver, error filtering, retry, skip, `fixme` or timeout increase.
- QA P2 language-quality corrections in the new Italian `orders2b1` catalog (`Modalità`, `è`, `verrà` and any exact same-scope accent omissions proved by review) are allowed as presentation-only corrections with catalog tests. The AppBar source-string test coupling and legacy NavigationGuard raw-console diagnostic are recorded P2 follow-ups and are not release blockers in this remediation; do not expand into a component rewrite or logging architecture change.
- After remediation, rerun focused tests, full Node 22.12 lint/typecheck/Vitest/build, the complete default and heavy Chromium/WebKit stories, regenerate/inspect sanitized screenshots and renew independent QA plus Architecture/Security. Any P0/P1, locale-dependent canonical value, duplicated create, changed idempotency behavior, customer/print/warranty/scanner change or weakened gate blocks the batch.

### Release 2B-1 second-review evidence-completion Delta (2026-09-02)

- The renewed Architecture/Security review closes both original P1 findings with P0 = 0 / P1 = 0, but renewed QA fails closed with P0 = 0 / P1 = 1 because several state-matrix labels are not backed by concrete runtime assertions. This is an evidence defect, not authorization to change production behavior.
- Keep the writer test-only in `src/features/orders/screens/new-order-screen.i18n.test.tsx` and `src/features/orders/screens/order-task-screen.i18n.test.tsx`, plus an existing directly related focused component test only if the screen harness cannot observe the state. Add explicit assertions for New Order `scopeReady=false`, localized discard, finance hidden/read-only behavior, separate-identity resolution, six unknown status checks leading to `uncertain`, manual retry reusing the original `operation_id`, and dirty-leave save/discard completion. Add explicit Task assertions for diagnosis pending/success/error, quote pending/success/error, Kiosk success, and transition optional reason, required-empty blocking, conflict, error and success.
- Test names, static source scans and callback existence are not acceptance evidence. Each item must assert the localized visible state and, where relevant, the exact canonical mutation input or idempotency value. Do not modify production source, APIs, permissions, payloads, routing, timers, browser readiness, CI, or any customer/print/warranty/scanner surface.
- Rerun the focused state suites, full Node 22.12 gates and both 21-case browser matrices, restore generated files, then renew independent QA and Architecture/Security. P0/P1 must be zero before the batch closes.

### Release 2B-1 local closure (2026-09-02)

- Release 2B-1 is locally complete. The stable guidance contract, three-locale canonical mutation and idempotency proof, complete localized state matrix, six-width core matrix, three heavy journeys and in-place locale-switch preservation all pass without retry, skip, expected failure or assertion waiver.
- Final main-thread evidence is Node 22.12 lint/typecheck PASS, Vitest 479 files / 3,381 tests PASS, production build 30/30, Chromium 21/21 and WebKit 21/21. The previously observed diagnosis-error test race was corrected by awaiting the actual rejected-Promise UI state and then passed five writer cold runs, one main-thread cold run and three independent QA cold runs, each 85/85.
- Final independent QA and Architecture/Security both return PASS with P0 = 0 / P1 = 0. Three registered P2 follow-ups remain: browser `networkidle` readiness coupling, AppBar source-string test coupling, and the legacy NavigationGuard raw console diagnostic. None authorizes scope expansion in the next product batch.
- This is a local milestone only. No staging, commit, push or deployment occurs until the remaining Release 2B batches finish and the final exact-SHA release gates pass.

## Release 2B-2 Order Detail frozen change contract (2026-09-02)

### Decision and staged scope

- Release 2B-2 covers production-reachable employee UI on direct `/orders/[id]` and the existing Order Detail workspace opened from `/orders`. Because the screen exceeds 6,000 lines and owns multiple high-risk workflows, implementation is internally split into 2B-2A core/detail presentation plus safe error/date boundaries, then 2B-2B nested mutation dialogs and complete dynamic evidence. Both remain one ordered Order Detail milestone; Customers cannot start before both close.
- Chinese remains the baseline. Italian and English localize fixed employee titles, labels, help, placeholders, ARIA, validation, loading/empty/error/permission/offline/conflict/pending/success states. Customer/store/staff/supplier/device names, identifiers, phone, issue/diagnosis/notes, custom quote/repair/workflow text, attachment names and historical payload values remain byte-equivalent.
- Locale is presentation-only. No route, query/cache key, permission/capability, mutation field, canonical status/kind/action, audit reason, customer message body, warranty value, print/customer document, QR credential, Scanner/Camera/IMEI recognition or persisted data may change.

### Frozen implementation boundaries

- Shared presentation: `src/shared/i18n/messages.ts`; a new pure `src/features/orders/model/order-detail-i18n.ts` plus focused test; `src/features/orders/model/order-i18n.ts` only for stable-code reuse that does not change Release 2B-1 behavior.
- Core screen/shell: `src/features/orders/screens/order-detail-screen.tsx`; `src/features/orders/components/order-detail-skeleton.tsx`; `order-detail-tabs.tsx`; `order-hero.tsx`; `order-overview-tab.tsx`; `order-photo-preview-dialog.tsx`.
- Reachable employee workflows: `order-terminal-actions.tsx`; `order-internal-cost-card.tsx`; `order-parts-allocation-panel.tsx`; `order-contact-menu.tsx`; `src/features/orders/forms/cancel-dialog.tsx`; `payment-dialog.tsx`; `notify-dialog.tsx`; `customer-phone-lookup.tsx`; `src/features/suppliers/components/order-supplier-picker.tsx`; `src/features/customers/forms/customer-backup-phones-field.tsx`; `src/components/store/store-output-identity-recovery.tsx`; `src/shared/ui/whatsapp-recipient-editor.tsx`; employee-only chrome in `order-print-paper-dialog.tsx`, `fixed-pdf-ready-dialog.tsx` and `warranty-picker.tsx` only when proved reachable.
- Cross-feature/shared consumers must preserve their current default API and all other callers. Prefer optional localized display props or current-locale lookup; do not change component lifecycle, request construction or canonical values.
- Test allowlist includes directly corresponding existing tests, a new `src/features/orders/screens/order-detail-screen.i18n.test.tsx`, focused component tests, `tests/e2e/i18n-order-detail-release-2b2.spec.ts`, `.github/workflows/ci.yml` only to include that spec, and sanitized `screenshots/release2b2/{chromium,webkit}`.

### Stable presentation and error/date contract

- System workflow labels use `status.code + is_system`; custom workflow labels remain original. Guidance uses `guidanceCode`; stages use `stage.key`; side badges use `badge.key`; events use `event_type + payload.action/result/status_changed/from/to`; custody, attachment, terminal, notification-template and cost-source labels use their canonical enum/code. Unknown/custom values remain original. No Chinese/English display-string matching is permitted.
- Payment choices separate display from payload: translated labels map to the existing canonical values `"现金"` and `"刷卡"`. The parts-release audit reason `"工单配件分配纠正"`, warranty text/months/change reason, user-edited WhatsApp body, notification recipient and all historical event fields remain unchanged.
- Every query/mutation/storage/provider failure is mapped at the employee presentation boundary from stable `RepairDeskApiError.code/status` plus operation; unknown failures use a safe generic localized message. Never render or log `error.message`, details, provider/storage/schema/bucket/policy text, or infer semantics from it. `PaymentDialog` must consume rejection and expose a safe localized error rather than an unhandled Promise.
- All visible employee dates/times use the current locale through existing shared formatters and retain the `Europe/Rome` time zone. Canonical timestamps remain unchanged.

### Idempotency baseline and stop condition

- Translation must not add, remove or rename any idempotency field. Existing caller-owned keys must remain identical across locale switches and same-logical-operation retry; generated UUIDs may be normalized only in test comparisons.
- Audit found a pre-existing issue: transition, cancelled-return and custody construct a new UUID per manual attempt, while approval decision has no caller idempotency surface. This contract does not silently redesign APIs or persistence. For operations that can safely recover with the existing client contract, tests must prove no duplicate mutation and status/read confirmation behavior. Any required API/type/repository/schema or approval idempotency change is a separate Owner-approved Plan Delta and blocks final 2B-2 closure; it may not be waived as an i18n exception.

### Explicit forbidden boundaries

- No change to `src/lib/repairdesk/api.ts` or types, `src/app/api/**`, `src/server/**`, `src/features/orders/server/**`, query keys/options/cache/realtime, offline hook/model, auth/permissions, schema/migration, environment, dependencies, lockfile, routes or locale provider/cookie.
- No change to `/orders/new`, `/orders/[id]/task`, customer-facing `order-message-templates.ts`, `order-italian.ts`, `repair-order-print-sheet.tsx`, PDF/print body generation, customer-status client/service/route, warranty normalization/persisted text, IMEI Scanner, Camera, OCR, QR/parser or capture code. Release 2B-1 files are reuse-only unless listed above.
- Dynamic/historical Chinese is an explicit evidence exception, not permission to translate data. Screenshots must use synthetic data and contain no production PII, credential, token or raw error.

### Acceptance and release gates

- Component/screen tests cover tri-locale default, loading, no-store, not-found/read-error, permission/read-only/finance-redacted, validation/focus/ARIA, offline states and restore/discard, remote conflict, dirty-leave, pending/success/known-error/unknown-error, custody/unlock, combined ordinary+finance save, attachment, quote/approval/notify/payment/Kiosk, supplier/assignee, terminal actions, parts and internal cost.
- Three-locale runtime inputs for patch/finance/transition/cancelled-return/custody/diagnosis/quote/unlock/supplier/assignee/payment/approval/Kiosk/terminal/parts and adjacent attachment/quote-confirm/WhatsApp calls are normalized-deep-equal. Canonical reasons/methods/body/warranty/custom values remain exact. Permission fixtures include owner, manager, assigned/unassigned technician, sales and viewer, with zero unauthorized request.
- Browser core matrix is 3 locales × widths 390/430/768/1024/1280/1440 × Chromium/WebKit = 36 cases for direct detail plus the existing workspace dialog at representative 390/768/1440. Each verifies one renderer, locale/lang, current fixed chrome, reachable actions, no page overflow, scoped fixed-Han classification, zero page/console error and zero unexpected mutation.
- Both engines run heavy journeys at Chinese 390, Italian 768 and English 1440. At least one in-place `en → it → en` switch during a controlled pending mutation preserves URL/order ID, document identity, selected tab/dialog, draft/dynamic values, focus/scroll, pending lock, canonical body and any existing caller-owned idempotency key.
- Store/user draft isolation, permission redaction, safe-error sentinel exclusion and frozen print/message/warranty/scanner boundaries receive explicit tests. Browser requests are loopback fixtures only; every write path must be individually allowlisted/intercepted and unknown origin/method/path fails closed.
- Node 22.12 lint/typecheck/full Vitest/build, catalog parity, focused suites, Chromium/WebKit with `retries: 0`, `--forbid-only --fail-on-flaky-tests`, at least 44 sanitized screenshots, and renewed independent QA plus Architecture/Security P0 = 0 / P1 = 0 are required. No stage/commit/push/deploy occurs until the entire six-batch parent sequence completes.

### Rollback and stop conditions

- Rollback is a normal forward revert of the bounded presentation/test/CI delta; no data or environment rollback is expected.
- Stop on any locale-dependent payload/permission/query/route, translated dynamic/canonical/customer/legal/print/warranty/scanner value, raw error/credential exposure, unexpected mutation, duplicated irreversible action, API/type/schema need, dirty ownership ambiguity, or unresolved P0/P1.

### Release 2B-2A independent-review remediation Delta (2026-09-02)

- The first 2B-2A review fails closed: QA reports P0 0 / P1 4 and Architecture/Security P0 0 / P1 3. The stable code/status error mapper, locale-aware dates and basic mutation equality remain useful, but the slice cannot close.
- Dynamic fidelity correction may extend the writer allowlist to `src/features/orders/model/order-side-statuses.ts` and its test solely to expose the already-known supplier name separately from fixed badge copy. Localized badges must interpolate that original value without parsing `badge.label`. Event presentation must preserve `status_changed.reason`, `quoted.amount`, `approval_sent.status_changed`, payment money formatting, changed fields and all other historical payload data while localizing only fixed wrappers; summary and full-timeline modes must not erase different information.
- Revert every 2B-2A change to the IMEI Scanner entry copy in `order-overview-tab.tsx`; the field label, placeholder, scan trigger/title and save action return to the pre-2B-2 baseline. Parser, recognition, value and request behavior remain untouched. Separately, the existing `mutateAsync` rejection may be consumed only to prevent an unhandled Promise after the existing mutation error handler has run; no scanner text, focus, open-state, payload or error semantics may otherwise change.
- Complete the already-allowed core mobile/desktop chrome, remote-conflict and local validation/fallback copy. Extend the allowlist to `src/features/stores/components/store-shell-unavailable-state.tsx` and its focused test only for optional display overrides supplied by Order Detail; every existing caller and default remains byte-compatible.
- Preserve combined-save partial-success semantics with a safe localized message that explicitly names completed fixed steps without exposing the raw failure. Catch clipboard rejection in `OrderHero` and expose a safe localized failure. No raw `Error.message`, silent rejection or page error is accepted.
- Expand tests with supplier-name and historical-payload sentinels, money formatting, approval transition distinction, changed fields, real Overview tri-locale runtime, direct compact/mobile and desktop core rendering, core conflict/validation, partial-save recovery, clipboard/IMEI rejection containment and no-store overrides. The existing Scanner copy/presentation diff must be zero except the narrowly allowed rejection consumption.
- Rerun Node 22.12 focused tests, 2B-1 regression, target lint/typecheck/Prettier/diff and renew independent QA plus Architecture/Security. Do not begin 2B-2B until P0/P1 are zero.

### Release 2B-2A local closure / 2B-2B activation (2026-09-02)

- The corrected 2B-2A slice is locally complete. Final QA reports PASS with P0 0 / P1 0 and one non-blocking invalid-date/DST robustness P2; final Architecture/Security reports PASS with P0 0 / P1 0 / P2 0.
- Stable supplier and event adapters preserve all dynamic/history/warranty fields; owned error surfaces no longer expose raw provider text; visible owned dates use current locale with Europe/Rome; compact/desktop/no-store/conflict/partial-save and rejection paths have runtime proof. IMEI entry copy is restored exactly, with only bounded rejection containment.
- Release 2B-2B is now active for reachable nested employee workflows: cancel, payment, notify employee chrome, terminal actions, internal cost, parts allocation, contact/phone, supplier, backup phones, store-output recovery, WhatsApp recipient editor and employee-only print/warranty controls. Customer message bodies, customer documents and persisted warranty values remain frozen.
- 2B-2B must also complete the direct/workspace browser matrix, heavy states, sanitized screenshots, complete canonical mutation/permission evidence and the registered invalid-date/DST P2 before final Order Detail closure. Any API/type/repository/schema need for the pre-existing idempotency limitation remains a stop condition, not an implicit authorization.

### Release 2B-2B pre-browser remediation Delta (2026-09-02)

- Independent QA and Architecture/Security fail the first 2B-2B slice with P0 0 and P1 findings covering rejection containment, a customer-message payload regression, one fixed-Chinese unlock label, cost-source fidelity and insufficient mutation/permission evidence. No browser acceptance may start until these are corrected and re-reviewed.
- Consume rejected Promises at the Cancel, approval decision, attachment/photo upload and asynchronous customer-pick UI action boundaries. Existing mutation `onError` remains the sole safe user message owner where present; failure must preserve dialog/draft/open state and produce no unhandled rejection, duplicate toast, page error or raw sentinel.
- Restore Notify exactly to the pre-2B-2 `body.trim()` contract for WhatsApp URL construction and the confirmation mutation. Editor draft may retain whitespace, but the captured customer-message payload, recipient, template, confirmation ID and retry idempotency input must match baseline in every locale.
- Localize the fixed employee Device Unlock entry label `密码` while preserving the unlock value and existing 2B-1 component behavior. This is not Scanner/Camera/IMEI authorization.
- Internal-cost source presentation must explicitly cover every current stable source code including `manual_blank` and `historical_unknown`; unknown values remain original and never fall through to a misleading known label.
- Evidence must exercise actual three-locale correct/reopen/void terminal inputs and safe failures; internal-cost load/save/offline/conflict/pending/success/error plus exact updates; parts allocate/release/permission/error with exact IDs, quantities and audit reason; Cancel/Approval/Attachment rejection containment; supplier/assignee and nested capability zero-request paths; Notify baseline body normalization and same-key retry. Tests may mock the transport but may not replace the production callback/input construction being proved.
- Expand the writer allowlist to `src/components/navigation-guard-provider.tsx` and its focused test solely to remove the raw exception object from the existing console diagnostic. Logging may retain a stable failure category but no message/stack/response/payload. Also close the Promise-typed CustomerPhoneLookup callback compatibility risk. No API/type/server/query/cache/permission/customer/print/warranty/scanner behavior changes.
- Repeat Node 22.12 focused suites, all 2B-1/2B-2A regressions, lint/typecheck/Prettier/diff and independent QA plus Architecture/Security. P0/P1 must be zero before the 2B-2 browser packet.

### Release 2B-2B attachment and photo-permission evidence correction (2026-09-02)

- Renewed QA inspection of the production `CameraCaptureSheet` proves that successful local capture/file selection invokes `onCapture(...)` synchronously and then immediately clears its local photo and closes the Sheet. Because Camera/capture lifecycle remains a frozen Release 2A boundary, Order Detail must not alter that behavior merely to satisfy an over-faithful mock. The E-044 sentence requiring attachment-upload failure to preserve the Camera dialog/draft/open state is superseded only for this attachment caller.
- The corrected attachment requirement is: use the real Camera behavior or a faithful mock; consume the detached upload rejection; show only the existing safe localized Order Detail error; emit no unhandled rejection, page error, raw sentinel, duplicate upload or duplicate toast; and retain the existing close/clear/object-URL-revoke semantics. Recovery remains explicit reopen and retake/reselect. Cancel, approval and customer-pick paths keep their own existing dialog/draft preservation requirements.
- Renewed Architecture/Security review proves that the employee photo trigger must also fail closed when the actor lacks the server-enforced `order:photo_upload` permission. Before browser acceptance, the implementation must hide or disable both desktop and compact/mobile photo entry points and prove zero upload request for the viewer/no-capability fixture. It may reuse an already-projected capability only if independent review confirms that capability is an exact fail-closed match for the current server policy; otherwise this is an API/type/repository stop condition requiring a separate Owner-approved Plan Delta.
- This correction changes evidence to match production lifecycle and closes an authorization affordance; it does not authorize Camera/capture source, parser/OCR, upload payload, attachment API, server permission matrix, query/cache, schema, dependency or customer-output changes.

### Authorized Release 2B-2B exact photo-upload capability Plan Delta (Owner confirmed 2026-09-02)

- **Reason:** the server independently enforces `order:photo_upload`, but `OrderCapabilities` exposes no corresponding field. Independent Security rejects proxies such as edit, correct or Kiosk capability because they are not the photo permission contract and may diverge by role, scope or terminal state. This is the only currently known 2B-2 browser-gate issue that cannot be corrected inside the frozen presentation/test allowlist.
- **Minimal change:** add a backward-compatible, server-derived `canUploadPhoto?: boolean` to `OrderCapabilities`; project it from the existing scoped `permitted("order:photo_upload")` decision with the current voided-record UI boundary; mirror the same permission projection in the existing mock detail provider; and consume only `=== true` in the desktop Overview callback, compact/mobile photo button and Camera Sheet mount. Do not change the permission matrix, endpoint assertion, upload body, storage, attachment read projection or any role.
- **Proposed allowlist:** `src/lib/repairdesk/types.ts`; the capability projection only in `src/features/orders/server/order.repository.ts`; the matching existing repository capability test; `src/features/orders/testing/mock-api.ts` and its focused test; the already-active `order-detail-screen.tsx` and `order-detail-screen.i18n.test.tsx`. No `src/server/api/**`, `src/server/permissions.ts`, `src/lib/repairdesk/api.ts`, Camera/capture source, query/cache, schema, migration, dependency or config change.
- **Required evidence:** owner/manager/sales and assigned technician receive the projected affordance according to the existing scoped permission; viewer and unassigned technician fail closed; terminal non-void behavior remains aligned with the actual server permission decision; voided UI remains closed; desktop and compact/mobile entries plus Sheet are absent without capability; interaction attempts make zero upload requests; allowed capture retains the exact baseline request. Node 22 focused tests, typecheck/lint/Prettier/diff and renewed independent QA/Security must pass before browser work.
- **Rollback:** a normal forward revert of the optional projection, its three UI gates and tests. No data or environment rollback exists. The Owner explicitly confirmed this exact Plan Delta on 2026-09-02; implementation may proceed only inside the stated allowlist and gates.

### Release 2B-2 idempotency-governance correction (2026-09-02)

- Renewed independent Architecture/Security review classifies the pre-existing lost-response behavior as P2 rather than a Release 2B-2 P0/P1. Transition, cancelled-return and custody currently generate a new UUID per manual attempt; approval decision has no caller key and generates one inside the repository. Expected-version checks, approval-state preconditions and atomic mutations limit duplicate state writes, but true same-key replay recovery is incomplete.
- The earlier sentence stating that this limitation automatically blocks final 2B-2 closure is superseded because the Owner's controlling objective explicitly requires API/query/payload preservation. This i18n release must not redesign or proxy those inputs. It may close this axis only after proving canonical inputs are locale-invariant, no idempotency field was added/removed/renamed, the limitation is recorded as an existing P2, and no normalized-UUID test is misrepresented as same-key retry evidence.
- A future true lost-response recovery improvement remains a separate Owner-approved API/type/repository project. This correction does not affect or waive the independent photo-upload capability P1.

### Release 2B-2B browser evidence packet (activated 2026-09-02)

- The Owner-authorized exact photo capability patch passes renewed independent QA and Architecture/Security with patch P0 0/P1 0/P2 0. The browser gate is open; the only cumulative Order Detail P2 is the pre-existing lost-response recovery limitation recorded above.
- Add only `tests/e2e/i18n-order-detail-release-2b2.spec.ts` and the exact CI inclusion. Reuse existing controlled-loopback fixtures/helpers where compatible; do not edit application behavior to satisfy E2E. No retry, skip, fixme, expected-failure, error filtering or assertion/timeout waiver.
- Each engine runs 18 direct core cases (three locales × 390/430/768/1024/1280/1440), three representative workspace cases at 390/768/1440, and three heavy cases at Chinese 390, Italian 768 and English 1440. Chromium and WebKit therefore each require 24/24. Save at least one sanitized final screenshot per case under `screenshots/release2b2/{chromium,webkit}` for at least 48 PNGs.
- Core cases prove one active renderer, locale/html language, localized fixed employee chrome, representative dynamic value fidelity, responsive action visibility, no page overflow, fixed-Han classification and zero page/console/unhandled errors or unexpected writes. Workspace cases preserve the existing workspace URL/order ID and correct dialog/page surface.
- Heavy cases cover permission-limited photo affordance with zero upload, an allowed exact `fault_photo` upload intercepted locally, and an in-place `en → it → en` pending-flow switch preserving URL, order/document identity, selected tab/dialog, employee draft plus dynamic/customer text, focus/scroll, pending lock and canonical body/idempotency input. Existing P2 paths prove locale-invariant inputs without claiming same-key manual retry.
- The English 1440 heavy journey proves those preservation properties in two truthful sequential phases rather than manufacturing an impossible simultaneous state. Phase one opens the existing finance edit surface, enters an employee draft, switches `en → it → en` through the visible AppBar control, and proves the same URL/order/document, draft, dynamic/customer data, focus and scroll; it then exits editing through the normal UI. Phase two opens the existing inline transition surface, starts one locally intercepted no-reason transition, and while that single request remains pending switches `en → it → en`, proving the same URL/order/document, pending lock, dynamic/customer data, focus/scroll, canonical body and syntactically valid caller-owned idempotency key. Exactly one request is observed and the same captured body is compared before and after the switch; this is not represented as a retry. Selected workspace tab/dialog preservation remains covered by the dedicated workspace cases. This correction reflects the real contract: edit mode intentionally disables flow actions, and modal focus traps intentionally prevent reaching the external language switcher.
- Request interception is fail-closed by origin, method and path. Only fixture reads and explicitly asserted local writes are accepted; all unknown requests, production origins and non-loopback traffic fail the case. Screenshots and reports contain synthetic data only, with no credential, token, raw provider error or production PII.
- Integration Lead runs both engines with `workers=1`, `--forbid-only`, `--fail-on-flaky-tests`, restores any generated `next-env.d.ts` drift, inspects representative screenshots, then runs Node 22.12 full lint/typecheck/Vitest/build. Renewed independent QA and Security P0/P1 zero are required for final 2B-2 closure.

### Release 2B-2 first-browser correction Delta (2026-09-02)

- Chromium's first exact run executed all 24 stories and returned 4 pass / 20 fail. It exposed one real presentation defect: `OrderDeviceCustodyCard` localizes its description but mounts `DeviceCustodyBadge` without a localized label, so the stable `with_shop` enum still renders `门店保管` in Italian and English. The minimum application correction is limited to passing `localizeDeviceCustody(status, order.delivered_at, t)` at that existing call site and adding focused runtime proof. No shared badge, domain model, payload, permission or custody behavior changes.
- The same run identified harness corrections rather than product changes: compact detail has no desktop action-dock node; the workspace records/timeline view no longer exposes overview customer text; finance edit renders the customer as an input; and the fixed-Han classifier must allow complete text nodes containing registered dynamic values, canonical warranty/history data, and the approved Scanner boundary while continuing to reject unmatched fixed Han. The synthetic fixture warranty remains business data and must not be translated.
- The single writer may edit only `order-detail-screen.tsx`, its existing i18n test, the new 2B-2 E2E and exact CI inclusion. It must retain the 24-case contract, strict request/error gate, screenshots, no retry/skip/fixme/expected failure/timeout waiver, then rerun focused Node evidence and Chromium 24/24 before WebKit.
- Chromium subsequently passes 24/24. The first Integration Lead WebKit run reaches every story's final evidence check but all 24 fail only because WebKit/Next requests two same-origin static resources that the harness did not list: exact GET paths `/manifest.webmanifest` and `/__nextjs_font/geist-latin.woff2`. The writer may add only these two exact loopback read paths; no prefix/wildcard, external origin, method, API or write allowance is authorized. WebKit and Chromium must both be rerun after the correction.

### Release 2B-2 final visual-review remediation Delta (2026-09-02)

- Although both engines pass 24/24 and produced 48 screenshots, independent QA/UX fails visual acceptance with P0 0/P1 3. At compact widths, `DetailRows` fixes the label column at 34px, causing Italian/English warranty, custody and accessories labels to draw into their values. The device section's two actions also consume the title row and truncate the primary title to a single letter at 390/430. Finally, stable approval value `not_required` is not mapped by `localizeOrderDetailApproval`, so raw underscore enum text appears in desktop quote/dock chrome.
- Minimum source allowlist: `order-detail-screen.tsx` and its existing i18n test; `order-detail-i18n.ts` and its test; `messages.ts`; the 2B-2 E2E; exact CI inclusion remains unchanged. At sub-640 widths, detail rows stack label above value; at 640+ they use an explicit readable label/value grid. Labels and values wrap without overlap. `MobileSectionTitle` stacks actions below/right at narrow widths and allows the primary title to wrap; the existing row arrangement returns at `sm`. Add only one new three-locale key for `not_required`, selected by the stable status value. Canonical payload/status values remain unchanged.
- Browser acceptance adds bounding-box proof that every visible detail-row label/value pair is separated rather than intersecting, 390/430 device-section title text is complete, raw `not_required` is absent in Italian/English, and after scrolling to the document end the last visible content section is fully above the fixed action dock. No layout-wide refactor, shared primitive/style token, API, state machine, payload, permission, retry/skip/timeout or error-gate change is authorized.
- Rerun focused tests, target static gates and both 24-case browser matrices; replace/inspect all 48 screenshots. Independent QA and Security must then return P0/P1 zero before 2B-2 closes.

### Full-suite nondeterministic assertion correction (2026-09-02)

- Final Node 22 full lint and typecheck pass. Full Vitest runs 491 files / 3526 tests and reports one unrelated failure in `repairdesk-ai-assistant-route.test.ts`: a whole-response string assertion rejects substring `999`, but the randomly generated response `request_id` legitimately contained those three hexadecimal digits. Immediate isolated rerun passes, proving nondeterminism rather than data exposure or product regression.
- The exact returned card is already asserted with `toEqual`. Replace only the brittle whole-response numeric substring assertion with explicit absence checks for the sensitive finance projection fields (`quotation_amount`, `deposit_amount`, `balance_amount`, `fault_prices`) on the returned card. Keep the protected string sentinel assertion. No router, projection, provider, UUID, production behavior or fixture value may change. Run the focused file and then the complete Vitest suite again.

### Release 2B-2 strict-write-origin browser remediation (2026-09-02)

- Final QA/UX passes with P0 0/P1 0 after visual remediation, but independent Security fails the cumulative browser gate with P0 0/P1 1. `isAllowedRead` requires exact `baseOrigin` and loopback, while the explicit write branch currently accepts only `METHOD + pathname`; an external or production origin with the same allowed upload/transition path could therefore fall through, and path-only write evidence could misreport it as allowed.
- Test-only correction in the 2B-2 E2E: the allowed-write predicate must require exact `baseOrigin`, loopback hostname, method and pathname before fallback. Evidence must distinguish allowed local writes from forbidden external writes. In each allowed-write heavy journey, issue one caught `no-cors` POST to a synthetic non-production `.invalid` origin with the same allowed path; the route must abort it, record the exact external URL as forbidden, and never count it as an allowed local write. The final evidence assertion may accept only that explicitly expected blocked probe while every other forbidden request remains a failure.
- Do not add a 25th test, external network traffic, a wildcard/prefix/origin waiver, retry/skip/timeout, or any application/CI change. Rerun both existing 24-case matrices and renew Security review before closure.
- The same Security review also corrects the frozen evidence ledger: transition and custody have three-locale runtime inputs, but `cancelled-return` does not. Add only a screen-test mock for the existing `confirmCancelledOrderReturn` import, render the same cancelled/with-shop/can-confirm fixture in Chinese, Italian and English, open the existing return overlay and confirm once, then compare `[orderId, expectedUpdatedAt, normalizedUuid]` across locales. Require one call per locale and a syntactically valid UUID before normalization; do not claim same-key manual retry. No production callback/API/payload change is authorized.

### Release 2B-2 final local closure / Release 2B-3 activation (2026-09-02)

- The two final Security evidence gaps are closed test-only. Allowed browser writes now require exact `baseOrigin`, loopback hostname, write method and exact method/path allowlist membership. The Italian upload and English transition journeys each prove that a synthetic same-path `.invalid` POST is aborted before network escape, recorded separately and never counted as a local allowed write; every other unknown request still fails closed.
- Cancelled-return now has real Chinese, Italian and English UI confirmation evidence. Each locale invokes the existing callback exactly once with the same order ID and expected `updated_at`; every generated UUID is syntactically valid and is normalized only for locale-equivalence comparison. This does not prove or claim same-key manual retry, and the existing lost-response recovery limitation remains the only cumulative P2.
- Final evidence is green: Chromium 24/24, WebKit 24/24, 48 sanitized screenshots, Node 22 lint/typecheck, Vitest 491/491 files and 3527/3527 tests, production build 30/30, final QA PASS P0 0/P1 0, and renewed Security PASS P0 0/P1 0/P2 1 existing. Release 2B-2 Order Detail is locally closed.
- Release 2B-3 Customers is now active. Before any customer source write, perform a fresh route/consumer/dynamic-data/API/permission/customer-output audit and independent QA/Security baseline, then freeze a bounded presentation-only contract and single-writer allowlist. No partial stage, commit, push or deploy is authorized.

### Release 2B-3 Customers frozen contract (2026-09-02)

#### Scope and sequence

- 2B-3A localizes the customer list, filters, rows/cards, status summaries, skeleton/error/empty/pagination/create shell and stable presentation adapters. 2B-3B localizes direct/preview detail, hero/tabs/panels/profile/device sheet and create/edit/device/follow-up/message/tag dialogs, and closes the bounded rejection/responsive/accessibility defects. 2B-3C adds the dedicated strict browser/CI evidence packet. Each slice receives focused Node gates and independent review before the next slice.
- Routes, renderer choice and navigation semantics remain unchanged: `/customers` renders desktop rows or compact cards and a desktop detail preview Dialog; `/customers/[id]` renders the direct detail page. Search/filter/page URL parameters and customer-to-order hrefs remain canonical.
- Stable presentation uses quick-group/work/follow-up/marketing/tab/current-item/follow-up/channel/language/workflow codes and explicit frontend-only kinds. It must never parse Chinese labels, titles or action text to infer semantics. Known system order states may reuse the existing stable workflow localizer; unknown/custom values remain original.

#### Dynamic, persisted and customer-output boundaries

- Preserve customer name, primary/backup phones, email, notes and marketing notes; custom tag names/colors/IDs; store and employee names; brand/model/IMEI/serial/device notes; order public number/issue/custom workflow; follow-up title/note/owner/order/time; interaction/message/history body; raw `warranty_text`; IDs, timestamps, URLs, consent and language/channel canonical values.
- `buildCustomerMessage`, recipient canonicalization, `wa.me`/SMS URL, fixed Italian customer-facing body, employee-edited body, trim behavior and “open first, record only after employee confirmation” lifecycle are frozen. The persisted default follow-up title `维修后联系客户` remains byte-identical in every employee locale.
- Date display follows the employee locale with `Europe/Rome`; invalid dates use a safe localized fallback. Canonical timestamps and the existing `datetime-local`/ISO conversion are unchanged. The existing lost-response/idempotency and local/UTC semantics remain disclosed P2s, not silently redesigned.

#### Security, permission and error contract

- Consume rejected edit/device/follow-up/message/tag Promise callbacks at their existing UI action boundaries after the existing mutation `onError` owns the safe localized toast. Preserve dialog/draft/open state where current lifecycle allows, exactly one call, zero raw error/sentinel and zero unhandled rejection/pageerror.
- Customer navigation/actions currently lack exact StoreContext customer capabilities. Because server authorization remains fail-closed and the Owner objective freezes API/types/permissions, this is a cumulative P2 and is not changed here. The release may claim only that locale never changes the authorization result: owner/manager/sales behavior remains equivalent; technician/viewer remain rejected before repository/write side effects. It may not claim hidden unauthorized controls or zero HTTP requests. Any new customer capability, role proxy or shared-navigation visibility change is an Owner Plan Delta stop condition.
- Keep customer API/router/repository/schema/permission/query/cache/realtime/tenant behavior frozen. UI read/mutation failures use safe localized messages and never render/log provider, storage, schema, policy, response, stack or raw `error.message` details.

#### Source allowlist and forbidden paths

- 2B-3A allowlist: `src/shared/i18n/messages.ts` and its message tests; new `src/features/customers/model/customer-i18n.ts` and test; presentation-only additions in `customer-list.ts`, `customer-workbench.ts` and their tests; `customer-list-screen.tsx`, `customer-list-items.tsx`, `customer-list-skeleton.tsx`, `customer-status-badges.tsx`, `customer-filters.tsx`, and directly corresponding new/existing tests.
- 2B-3B allowlist: `customer-detail-screen.tsx`; all Customers-owned `customer-*` detail/hero/tab/panel/profile/device components; Customers-owned create/edit/device/follow-up/message/tag forms and corresponding tests. `customer-backup-phones-field.tsx`, `store-output-identity-recovery.tsx` and `whatsapp-recipient-editor.tsx` are reuse-only unless an independently proven defect requires a separately frozen delta.
- 2B-3C allowlist: new `tests/e2e/i18n-customers-release-2b3.spec.ts`, exact CI inclusion and sanitized `screenshots/release2b3/{chromium,webkit}` evidence only.
- Forbidden: `src/lib/repairdesk/api.ts`, customer/store/API/router/repository/service/query/cache/realtime/tenant/permission sources, `src/server/**`, schema/migrations/data, status-link/token/public DTO, scanner/capture, Orders source, print/PDF/legal/export, shared navigation, locale provider/cookie, dependencies/lockfile/config, global styles/UI primitives and production data.

#### Acceptance and browser gates

- Runtime tests cover tri-locale list/detail/dialog states, fixed chrome, long Italian layout, loading/empty/stale/fatal/offline/403/redacted/pending/error/success, identity lookup conflict/error, five tabs, direct/preview focus behavior, device deletion rules, popup-blocked message flow and all valid dynamic-data exceptions.
- Three-locale actual callback inputs for create, update, device upsert/delete, tag update, follow-up create/complete and message are deep-equal. Customer-facing body/recipient/order/tag IDs, default persisted follow-up title and timestamps remain exact. A locale switch preserves URL/search/filter/page/tab/dialog/draft/dynamic values/focus/scroll/pending lock; modal focus traps are not bypassed to manufacture impossible interaction.
- Browser per engine: 18 `/customers` core cases (`zh/it/en × 390/430/768/1024/1280/1440`), three direct-detail cases at 390/768/1440 across the three locales, and three heavy cases at Chinese 390, Italian 768 and English 1440. Chromium and WebKit each require 24/24, `retries: 0`, `--forbid-only --fail-on-flaky-tests`, no skip/fixme/only/timeout or error-filter waiver, and at least 48 synthetic sanitized screenshots total.
- Request evidence requires exact base origin, loopback hostname, method and pathname. Every local write is explicitly allowlisted and body-asserted; unknown traffic fails. External WhatsApp/SMS or synthetic same-path origin probes are aborted before network escape and recorded separately. Console error, pageerror, unhandled rejection, raw sentinel, unexpected mutation, overflow, overlapping labels/actions, inaccessible long text or duplicate 768px page headers fail the case.
- Final gates: Node 22.12 lint/typecheck/full Vitest/build, focused baseline/regressions, both browser engines and renewed independent QA plus Architecture/Security with P0/P1 zero. The cumulative P2 ledger remains explicit. No stage/commit/push/deploy occurs until all six parent batches close.

#### Baseline and stop conditions

- Baseline focused evidence passes 15 files / 136 tests. Current release blockers are unfinished three-locale presentation, five unconsumed mutation rejections, missing canonical/locale-switch runtime evidence and missing strict dual-engine browser evidence. Current P0 is zero.
- Stop on any translated/mutated customer or historical value; changed customer message/default follow-up/payload/recipient/timestamp; locale-dependent authorization, route, query or cache; raw error exposure; duplicate write; API/type/repository/schema/permission need; dirty ownership ambiguity; or unresolved P0/P1.

### Release 2B-3A shared list-scaffold compatibility Delta (2026-09-02)

- Source inspection proves that the Customers compact search is owned by `RepairOsListScaffold`, whose non-empty search prefix, clear-search accessible name, default filter accessible name and pending status are fixed Chinese with no caller override. Replacing or hiding the scaffold would change the real responsive interaction and is not accepted.
- Extend the 2B-3A allowlist only to `src/shared/ui/repair-os-mobile.tsx` and its direct test. Add optional `searchPrefix`, `clearSearchLabel`, `filterLabel` and `preparingStatus` presentation props (or equivalently named exact slots) and consume them at the four existing text sites. Every default remains byte-compatible Chinese, every existing caller remains source-compatible, markup/lifecycle/layout/viewport logic remains unchanged, and only Customers supplies three-locale values.
- Required evidence: existing shared scaffold tests remain green; a focused compatibility test proves all four overrides and the untouched Chinese defaults. No generic locale dependency, provider import, global component behavior, styles, UI primitive, responsive breakpoint or other caller change is authorized.

### Release 2B-3A local closure / 2B-3B activation (2026-09-02)

- Customer list, filters, rows/cards, status summaries, loading/empty/stale/fatal/redacted states, pagination and create shell now use zh-CN, it-IT and en employee presentation. Stable `kind`/code adapters preserve unknown/custom values, customer data, URL filters, hrefs, create payloads and intents. Date display uses the selected locale with `Europe/Rome` and a localized invalid-date fallback without changing canonical timestamps.
- `RepairOsListScaffold` has only the four authorized optional copy slots; Chinese defaults and existing callers remain compatible. An initially introduced `SidebarTrigger`/`mobileLeading` changed navigation semantics and was removed before closure. No customer API/query/cache/router/repository/schema/permission or shared-navigation change remains in this slice.
- Node 22 focused evidence passes 9 files / 74 tests; typecheck, target ESLint, Prettier, waiver scan and diff checks pass. Independent QA and Security both PASS with P0 0/P1 0. Browser and six-width evidence remains intentionally deferred to 2B-3C.
- Cumulative non-blocking P2s remain explicit: exact Customer UI capability projection is absent but server authorization remains fail-closed; `RepairOsListScaffold` can stringify an element-valued title in its inherited default pending status, while current production callers are strings and Customers passes an explicit string; additional exhaustive list-state and browser evidence remains due in 2B-3C.
- 2B-3B is now the only active write packet. Its allowlist is the already frozen Customers-owned detail screen, detail/hero/tab/panel/profile/device-sheet components, create/edit/device/follow-up/message/tag forms, `customer-i18n.ts`, `customer-workbench.ts`, `messages.ts`, and direct tests. `customer-backup-phones-field.tsx`, `store-output-identity-recovery.tsx` and `whatsapp-recipient-editor.tsx` are reuse-only.
- 2B-3B must localize only employee-facing presentation and consume the five existing rejected mutation Promises at the form/UI boundary while preserving one call, dialog/draft state and existing `onError` toast ownership. It must keep `buildCustomerMessage`, recipient and external URLs, fixed Italian customer body, default persisted follow-up title `维修后联系客户`, dynamic/history/warranty/custom-tag data, canonical values, timestamps, API/query/cache/permission and navigation semantics byte/behavior compatible.
- Within owned Customer files, correct the proven 768 duplicate-header condition, mobile 16px input and 44px target gaps, nested device-card keyboard bubbling, long Italian wrapping, localized Sheet/Dialog close/loading/ARIA states and safe raw-error fallbacks. Do not change global AppBar, shared Sheet primitive, styles or responsive breakpoints. Runtime evidence must deep-compare update/device upsert+delete/follow-up create+complete/message/tag callback inputs across all three locales and prove rejection containment.

### Release 2B-3B local closure / 2B-3C activation (2026-09-02)

- Direct and preview Customer detail, hero, five tabs/panels, profile/device surfaces and create/edit/device/follow-up/message/tag dialogs now localize fixed employee presentation for zh-CN, it-IT and en. Customer/device/tag/history/warranty/custom values remain original. The fixed Italian `buildCustomerMessage`, recipient/URL/trim/two-stage flow and persisted follow-up default `维修后联系客户` remain exact.
- Seven mutation callbacks have real three-locale deep-equal inputs. Five Promise-returning dialog boundaries consume rejection after the existing mutation `onError`, preserve current dialog/draft lifecycle, call exactly once and expose only safe localized toast text. Real Customer create no-match, exact conflict, safe lookup failure, save rejection and both create intents are exercised across all locales.
- Dates use locale + `Europe/Rome` with invalid fallback and unchanged canonical timestamps. The real follow-up status `done` maps by canonical code; unknown/custom values pass through. Customer child controls stop keyboard bubbling into the device card. Mobile inputs/actions meet the bounded 16px/44px contract.
- The 768 duplicate-header P1 is closed inside Customer source: the floating header is mobile-only and hidden at `md`, the direct page no longer reserves the floating-header offset at `md`, the AppBar remains untouched, the 768 bottom action bar remains, and the large-screen hero remains `lg`-only.
- Main final Node 22 evidence passes 17 files / 123 tests, typecheck, target ESLint, Prettier, diff-check and waiver scan. Independent QA PASS P0 0/P1 0/P2 1; final Security PASS P0 0/P1 0 with four cumulative P2s and zero new P2. Browser/geometry/request evidence remains intentionally unclaimed until 2B-3C.
- 2B-3C is active and test/evidence-only: add `tests/e2e/i18n-customers-release-2b3.spec.ts`, exact CI inclusion and sanitized `screenshots/release2b3/{chromium,webkit}`. Production source is frozen unless a browser-observed P0/P1 is separately recorded as a minimal remediation Delta. No stage/commit/push/deploy occurs at this milestone.

### Release 2B-3C first-browser remediation Delta (2026-09-02)

- The first complete Chromium run executes all 24 cases and returns 19 PASS / 5 FAIL. Italian 768 and English 1440 direct-detail cases expose a real P1: Customer-owned order/device card call sites mount the shared `StatusBadge` without a localized label, so canonical order status `completed` renders the shared Chinese fallback `已完成`.
- The minimum production allowlist reopens only `src/features/customers/components/customer-profile-blocks.tsx`, `customer-detail-panels.tsx` and their direct Customer tests. Reuse the existing stable `localizeWorkflowStatusLabel(undefined, canonicalStatus, t)` (or an equivalent existing stable order-status localizer) and pass the result through the existing `StatusBadge.label` prop at every Customer-owned call site. Preserve the shared badge, canonical status, configured/custom workflow data, tone, layout, routes and payloads. Add tri-locale actual-render proof for completed/cancelled and known statuses; no fixed-Han exception is allowed.
- The other three failures are harness corrections only. Expected error-state Customer API responses must use the already established response/status bridge so the browser does not emit a resource console error while the application still receives and renders the same safe failure state. Escape/focus evidence must assert the real Radix contract: the dialog closes and focus returns to its actual opener or the established next valid focus target; it must not require an invented trigger relationship or inject focus.
- Keep the 24-case matrix, strict request/error gate, screenshots, exact CI inclusion and zero retry/skip/fixme/only/timeout/error-filter waiver. After correction rerun focused Node/static tests and a fresh complete Chromium 24/24 before WebKit.

### Release 2B-3C WebKit hydration/focus remediation Delta (2026-09-03)

- The first complete WebKit run returns 21/24 after corrected Chromium 24/24. One English 1440 direct-detail case records a real hydration mismatch: when the store shell is not yet ready during server render, the disabled detail query has `isLoading=false` and the screen renders the fatal load-error branch; WebKit client bootstrap reaches the pending query before hydration and renders the loading skeleton. An isolated fresh one-case run passes, confirming a timing race rather than locale content, but the strict pageerror gate remains correct.
- Reopen only `customer-detail-screen.tsx` and its direct test to align the initial guard with the already proven Customer list contract: while no data/error exists, render the same localized skeleton when the shell is loading or an active store has a pending detail query. Use the query's actual pending state; do not change query key, enabled condition, retry, fetch, error/retry semantics or store shell. Add server/client initial-state branch evidence. No hydration error filtering is permitted.
- WebKit also proves a real controlled-Dialog focus gap: after opening the 768 follow-up dialog by its real button and pressing Escape, focus is not restored because there is no `DialogTrigger` and WebKit click focus does not supply a reliable ambient target. Reopen only Customer-owned `customer-detail-screen.tsx`, `customer-followup-dialog.tsx` and their direct tests to capture the actual invoking control and restore it with `preventScroll` through `DialogContent.onCloseAutoFocus`. Restore only a connected/visible intended opener, preserve outside-dismiss behavior and existing dialog state, and do not edit the shared Dialog primitive. E2E must assert the real opener is focused immediately after Escape; no Tab fallback or injected focus.
- A third failure is test-only: WebKit fetches a browser-local object URL `blob:<baseOrigin>/<uuid>`. The strict gate may allow only GET/HEAD where protocol is exactly `blob:` and its embedded origin exactly equals `baseOrigin`; an external-origin blob, blob write, ordinary external request or unknown local path must remain blocked. Add explicit pure predicate/probe evidence if practical. This is not an external network allowance.
- Preserve 24 cases, screenshots, exact CI inclusion and every other strict error/request assertion. Rerun focused Node/static tests, the three WebKit cases diagnostically, then complete fresh Chromium and WebKit 24/24; no retry/skip/fixme/only/timeout/error-filter waiver.

### Release 2B-3C controlled Device Dialog focus Delta (2026-09-03)

- The three previously failing WebKit cases pass 3/3 after the hydration/follow-up/blob correction. A fresh complete Chromium run then returns 23/24 because the English desktop preview's real `CustomerDeviceDialog` closes on Escape to a hidden Radix focus guard rather than the actual device-edit opener. The existing assertion was only checking a visible next focus and therefore correctly exposes a controlled-Dialog accessibility defect; adding Tab presses or accepting the hidden guard is forbidden.
- Reopen only `customer-device-dialog.tsx`, the Customer-owned device card/sheet/panel/screen callback chain needed to carry the actual invoking button, and direct tests plus the existing 2B-3 E2E. Apply the same bounded contract as follow-up: `DialogContent.onCloseAutoFocus` restores the connected and visible actual opener with `preventScroll`; no valid opener preserves Radix default and outside dismissal must not steal an unrelated target. Do not modify shared Dialog, generic focus utilities, routes, layout, device payload or mutation behavior.
- The heavy English E2E must assert the exact device-edit opener is focused immediately after Escape, with no Tab fallback or injected focus. Rerun focused/static gates, the case diagnostically, then fresh complete Chromium and WebKit 24/24.

### Release 2B-3C tablet tab-navigation remediation Delta (2026-09-03)

- Independent final QA found a browser-visible P1 after the nominal dual-engine pass: on the direct Customer detail page from `768` through `1023`, the mobile floating header (which owns one tab strip) is hidden at `md`, while the main tab strip remains hidden until `lg`. The result has one page header but no reachable Customer tab navigation, so orders, devices, follow-ups and profile are inaccessible from that tablet state. Existing 768 browser assertions did not require the five tabs and therefore did not detect the defect.
- Reopen only `src/features/customers/screens/customer-detail-screen.tsx`, its direct Customer test and `tests/e2e/i18n-customers-release-2b3.spec.ts`. Keep the unique AppBar header at `md` and expose the existing main `CustomerDetailTabs` for the page at `md` through desktop; preserve the dialog composition, mobile floating header below `md`, bottom actions below `lg`, all tab codes/panels, URLs, payloads, permissions, API/query/cache behavior and shared components.
- Add exact runtime/static evidence that the direct page has one header and all five localized tabs at `768`, has no duplicate tab strip at `390` or `1024+`, and that a non-overview tab can be activated at `768`. Both engines must rerun the complete unchanged 24-case matrix, regenerate exactly 24 screenshots each and retain zero retry/skip/fixme/only/timeout/error-filter waivers. Independent QA and Security must then return P0/P1 zero before 2B-3 can close or 2B-4 can start.

### Release 2B-3C device-history status-label remediation Delta (2026-09-03)

- Independent final Security found one reachable Customer-owned status fallback that the earlier card remediation and browser fixtures did not cover: `DeviceHistoryRow` inside `customer-device-sheet.tsx` mounts the shared `StatusBadge` without a localized `label`, so a Customer device Sheet with historical orders exposes the shared Chinese `已完成` / `已取消` labels in Italian or English.
- Reopen only `src/features/customers/components/customer-device-sheet.tsx`, its direct Customer runtime test and the existing 2B-3 E2E fixture/journey needed to open a device Sheet with history. Reuse `localizeWorkflowStatusLabel(undefined, canonicalStatus, t)` and pass its result to `StatusBadge.label`; keep the canonical status, history body, workflow/custom values, tone, order URL, device/delete rules and payloads unchanged. Do not change the shared badge or order status model.
- Add real tri-locale Sheet rendering for completed/cancelled/known canonical statuses, preserve unknown/custom pass-through, and make the 768 heavy browser journey open the historical device Sheet and reject fixed employee-Han leakage while allowing registered synthetic dynamic content. The same complete dual-engine and independent-review closure gates in the tablet Delta apply.

### Release 2B-3 final local closure / 2B-4 audit activation (2026-09-03)

- Customers list, direct/preview detail, five tabs, panels, device/history surfaces and create/edit/device/follow-up/message/tag forms now present fixed employee UI in zh-CN, it-IT and en. Dynamic/customer/history/custom/warranty values, canonical codes, all mutation inputs, fixed Italian customer message flow and persisted `维修后联系客户` remain invariant.
- Browser remediation closed the Customer-owned status-label gaps, SSR/client loading race, exact same-origin read-only blob classification, controlled Follow-up and Device Dialog focus restoration, 768 unique-header/full-five-tab reachability, and historical Device Sheet status rendering. Unknown/custom status values continue to pass through unchanged.
- Final Node 22 evidence passes focused 2 files / 39 tests, lint, typecheck, full Vitest 500 files / 3636 tests and production build 30/30. Chromium and WebKit each pass the exact 24-case matrix and produce 24 sanitized screenshots. Final independent QA and Security both PASS with P0 0/P1 0; four cumulative Customer P2s remain disclosed and are not represented as closed.
- Release 2B-3 is locally closed. Activate Release 2B-4 as read-only audit/contract work for current Inventory Products and Lifecycle routes. No partial stage, commit, push or deployment is authorized; Inventory source stays frozen until route/data/permission/dynamic-content and existing Quick Entry governance are reconciled into a new bounded contract.
## Release 2B-4 Inventory Products/Lifecycle frozen contract (2026-09-03)

### Decision and ordered slices

- Release 2B-4 covers the ten production App Router surfaces under `/inventory`: product list, direct Quick Entry, product detail/edit, reserve/sell, reservation/sale detail, after-sales queue and case. Legacy `src/routes/*`, `InventoryScreen`, `InventoryIntakeScreen`, `InventoryIntakeDialog`, `InventoryV2VisionDraft` and `InventoryLifecycleReadonlyScreen` are not production consumers and remain excluded.
- Implementation is ordered 2B-4A stable presentation substrate, 2B-4B Products read-only surfaces, 2B-4C Quick Entry create/edit and the already-authorized disclosure/state-evidence closure, 2B-4D Lifecycle, then 2B-4E strict browser/CI and independent review. One writer owns source at a time; no later slice starts before the prior focused gates and review evidence are acceptable.
- Chinese remains the baseline. Italian and English localize fixed employee UI, including titles, controls, help, ARIA/live regions, validation, loading/empty/error/permission/offline/conflict/outcome-unknown/pending/success and known stable-code labels. Dynamic and persisted values remain byte-equivalent.

### Stable presentation and immutable data boundary

- Add pure presentation adapters under `products/model/inventory-product-i18n.ts` and `lifecycle/model/inventory-lifecycle-i18n.ts`. Components pass the existing translator; adapters map only stable category/status/action/payment/disposition/coverage/inspection/identifier/validation codes to message keys. Unknown/custom values are returned verbatim. No display-string inference is allowed.
- Brand/model, catalog/manual color value, condition/specification values, SKU/location/source/reference, customer/store/staff names, notes/reasons/diagnosis/history, IMEI/SN/EID/GTIN and masked identifiers, IDs, money numbers, timestamps, versions, `allowed_actions`, canonical command/status/payment/disposition/coverage values, route/query values, CAS versions and idempotency keys must not change with locale.
- Color remains `value = existing canonical/persisted name` and `label = localized presentation where a stable color id is known`; Apple approved/pending manifests and existing historical colors remain unchanged. Do not edit catalog data or approve new colors.
- Employee-visible dates use the current locale and `Europe/Rome`; invalid/empty values return a safe localized fallback and never throw. Money uses the current locale with the existing EUR numeric value. OCR/vision service locale, legal/warranty receipt snapshots, print/customer messages and external content remain frozen.
- Locale switching must preserve route, query/filter/view, focus/scroll, draft, dynamic values, mutation body, expected versions and caller-owned idempotency keys, and must not trigger a request by itself.

### Product and responsive decision

- The newer reviewed Style C shelf implementation and its shipped tests postdate the older dense-list plan. This batch preserves that current source behavior and does not silently replace it with an older six-column/84–88px layout. The stale contradictory density sentences are a documentation-governance correction, not authority for a product redesign.
- Acceptance therefore requires the current shelf/list modes to remain selectable, one responsive renderer only, no duplicate ids, no horizontal overflow, readable long Italian labels, minimum touch/input sizing and intact mobile Sheet/desktop Popover behavior at `390/430/768/1024/1280/1440`.
- Quick Entry retains independent desktop three-column and compact DOMs, category-aware IMEI1 requiredness, visible IMEI2, planned sale and permission-gated acquisition cost. The previously approved autonomous follow-up closes disclosure-first gaps for network/version, warranty and manual supplements plus complete permission/offline/conflict/outcome/success evidence without API, catalog or persistence changes.
- `/inventory/[id]/sell` may present accurate employee wording for the existing staged sale/reservation workflow, but the existing `reservation.create` command and every payload field remain unchanged. Any business-command redesign is a separate Owner decision.

### Bounded implementation allowlist

- 2B-4A: `src/shared/i18n/messages.ts`; the two new presentation adapters and tests; presentation-only corrections in existing inventory validation/projection/timeline/receipt/error/freshness/availability/no-action models and their tests.
- 2B-4B: the four Product screens; queue/detail/workbench/section/action/page-frame components; shared Inventory consequence/conflict/error/receipt/freshness/sync/no-action/availability panels; corresponding focused tests.
- 2B-4C: Product create dialog, intake/edit screens, form/workspace/catalog/selectable/identifier components, directly corresponding tests and existing Storybook stories. Shared UI primitives remain reuse-only unless a later review proves an exact need.
- 2B-4D: the production lifecycle reservation/sale/after-sales screens, lifecycle page shell/status/timeline/workspaces/sale panels/field feedback, reservation/inspection forms and corresponding focused tests.
- 2B-4E: a strict Inventory release E2E, `.github/workflows/ci.yml` only to enumerate it, sanitized `screenshots/release2b4/{chromium,webkit}`, and documentation sync for the superseded inventory-density statement.

### Security remediation stop and separate Delta

- Read-only Security found one release-blocking baseline defect: `inventory/products/edit-data` can return raw provider diagnostics because it is the only adjacent Product read not wrapped by `failInventoryProductsRead`.
- The proposed remediation is intentionally separate and only two files: `src/server/api/repairdesk-router.ts` wraps that repository call in the existing safe mapper; `src/server/api/repairdesk-router.test.ts` proves a provider sentinel becomes exact generic 500, stable structured errors still pass through and success response is unchanged. It changes no request/success shape, query/cache, schema, repository, payload, permission or feature flag.
- This API failure-status correction requires explicit Owner confirmation after the discovery. Until confirmed and independently reviewed, Product UI work may continue but Release 2B-4 cannot close or enter the final release candidate.

### Authorized Release 2B-4 edit-data safe-error Delta (Owner confirmed 2026-09-03)

- The Owner explicitly confirmed the proposed narrow security correction. After the active 2B-4B UI writer closes and releases single-writer ownership, implementation may change only `src/server/api/repairdesk-router.ts` and `src/server/api/repairdesk-router.test.ts`.
- Wrap the `inventory/products/edit-data` repository read with the existing `failInventoryProductsRead` boundary. A provider/database sentinel must become the exact existing safe generic 500 response; stable structured application errors must keep their current status/message contract, and the successful response must remain byte-equivalent.
- This Delta does not authorize request or success-shape changes, API client/type/query/cache/repository/schema/data/payload/permission/feature-flag changes, logging of raw diagnostics, or any stage/commit/push/deploy action. Run the focused router security tests and obtain renewed independent QA plus Architecture/Security acceptance before total 2B-4 closure.
- Rollback is a normal forward revert of the two-file error-boundary change and its tests; there is no data or environment rollback.

### Known non-blocking and deferred boundaries

- Lifecycle realtime currently invalidates Product queries across devices but not `inventoryLifecycleKeys`; after-sales and edit readiness lack exact shell capability projections; reservation customer search uses an ad-hoc store-scoped key; preload warms the legacy summary. These require realtime/type/StoreContext/startup/API deltas and are not authorized in this presentation release. Server authorization/CAS remain fail-closed; do not claim exact zero-request UI capability or automatic cross-device lifecycle convergence.
- Lifecycle lost-response recovery is accurately described as write lock, readback and explicit user re-decision; do not claim universal same-key replay. Unreachable legacy raw-error components remain excluded and must be remediated before any future reconnection.

### Acceptance and gates

- Focused tri-locale tests prove fixed-copy coverage, unknown/custom passthrough, dynamic-value byte equality, safe invalid dates and Europe/Rome DST boundaries, color label/value separation, permission/cost/identifier redaction, create/update and all reachable lifecycle canonical payload equality, CAS/idempotency preservation and no locale-triggered request.
- Strict Chromium and WebKit each cover all three locales and all six widths across Product list/new/detail/edit plus every lifecycle route and the high-risk permission, offline, invalid, pending, conflict, unknown-result, sync, Apple approved/pending, Sheet/Popover/Escape/focus/last-option and locale-switch states. Exact loopback origin/method/path/body request gates fail closed; synthetic data only; no real write or external request.
- The release E2E contains no skip/fixme/only/retry/timeout/error-filter waiver and generates sanitized screenshots for both engines. Node 22.12 lint, typecheck, full Vitest, production build, Chromium/WebKit with retries zero/forbid-only/fail-on-flaky, and renewed independent QA plus Architecture/Security at P0/P1 zero are mandatory before local closure.
- No commit, push or deployment occurs until 2B-5 and 2B-6 also close and the exact final SHA passes the parent release gates.

### Rollback and stop conditions

- Each slice rolls back through a forward revert of its bounded presentation/test/docs delta; no data or environment rollback is expected.
- Stop on translated dynamic/canonical/legal/customer values, locale-dependent payload/query/permission/route/CAS/idempotency, full identifier or cost leakage, raw provider diagnostics, unexpected mutation, API/type/schema/realtime/startup need outside an explicitly approved Delta, dirty ownership ambiguity, or unresolved P0/P1.

### Release 2B-4A independent-review remediation Delta (2026-09-03)

- The first substrate candidate is mechanically green but independent QA and the bounded Architecture/Security cross-review agree on P0 0 / P1 2, so 2B-4A remains open.
- Unknown ledger event types currently inherit the resolver's fixed Chinese generic label `业务事件`. The adapter must use a new localized stable generic-event key whenever `source === "ledger-event"` and the event type is not in the known allowlist, while preserving raw event type, from/to status, timestamp, id and other history facts. Custom milestone labels remain verbatim; do not compare the Chinese display string.
- The initial receipt adapter collapses eleven command-specific employee confirmation semantics into one generic description/ledger/next-step set. Replace it with an exhaustive stable-command presentation map that retains the existing meaning for payment append-only and derived balance, pickup and warranty start, warranty append-version, reservation cancellation/refund handling, after-sales ledger semantics and each distinct next step. Confirmed and replay titles remain distinct; replay must state that the earlier write is being shown and no new write occurred.
- Expand direct tests to cover all eleven commands in all three locales, confirmed/replay distinction, the high-risk command semantics, unknown ledger event generic copy, and exact preservation of canonical/history fields. Result IDs, raw server fields and sensitive values must not be introduced into receipt copy.
- This remediation reopens only `src/shared/i18n/messages.ts`, `inventory-lifecycle-i18n.ts` and its direct test. Product adapter files remain read-only. Rerun Node 22 focused/messages parity/typecheck/lint/Prettier/diff/waiver and renew both independent reviews before 2B-4B.

### Release 2B-4A future-command safety correction (2026-09-03)

- Renewed QA proves that the exhaustive known-command receipt map dereferences `undefined` for a future/unknown runtime command, while the existing resolver intentionally emits a generic receipt for unknown commands. This is one remaining P1 because localization must never turn a forward-compatible receipt into a page crash.
- Reopen only `inventory-lifecycle-i18n.ts` and its direct test. Add a safe unknown-command branch that preserves canonical `command`, `kind` and `replayed`, uses localized generic employee confirmation/ledger/next-step copy, distinguishes confirmed/replay and never exposes raw command-derived diagnostics, IDs, amounts or result fields. Do not cast unknown values into the known map or infer semantics from display text.
- Add three-locale confirmed/replay runtime tests using a future command and prove no throw plus exact canonical discriminator preservation. Repeat the same Node 22 and independent-review gates; no other file is authorized.

### Release 2B-4A local closure / 2B-4B activation (2026-09-03)

- The stable Product/Lifecycle presentation substrate is locally complete. It provides 223 parity-checked message keys, stable known-code adapters, unknown/custom passthrough, color value/label separation, safe structured error copy, current-locale Europe/Rome dates and EUR money, canonical-preserving projection/timeline behavior, eleven command-specific employee operation receipts and safe future-command receipts.
- Review-found unknown-event, receipt-fidelity and future-command crash defects are closed. Final main Node 22 evidence is 3 files / 81 tests plus typecheck/diff; renewed independent QA and Architecture/Security both PASS with P0 0/P1 0/P2 0.
- Activate 2B-4B for production Product list/detail read-only employee surfaces and shared read-state panels. Quick Entry create/edit and Lifecycle writes remain frozen until their ordered slices. The separate router raw-provider-error P1 still awaits explicit Owner authorization and continues to block the total 2B-4 milestone, not this closed substrate slice.

### Release 2B-4B independent-review remediation Delta (2026-09-03)

- The Product-owned list/detail candidate is mechanically green but independent QA and Architecture/Security fail it with P0 0 and three related P1 classes. Product Detail directly mounts lifecycle-owned cards in its default and feature-on DOM, reference-image accessible text remains fixed Chinese, and inferred catalog color IDs are incorrectly used to translate dynamic/historical color display text.
- Reopen `inventory-product-queue-components.tsx`, its direct/list tests and messages only to: localize the fixed reference-image wrapper/alt while preserving original brand/model and image URL/match; keep catalog inference for visual swatch/reference matching only; always render/title/announce the Product list color from the original `color.value` when the DTO has no authoritative stable color id. Do not translate from a display-string inference or change any persisted/catalog value.
- Reclassify as 2B-4B the lifecycle components directly mounted by Product Detail: `inventory-lifecycle-status.tsx`, `inventory-lifecycle-page-shell.tsx`, `inventory-lifecycle-timeline.tsx`, `inventory-inspection-editor.tsx`, `inventory-lifecycle-field-feedback.tsx`, plus the existing shared conflict/error/receipt/sync/no-action/availability/read-freshness panels actually reachable from this path and their direct tests. Localize their fixed employee UI through 2B-4A stable adapters; preserve canonical status/command/allowed-actions/versions, dynamic history/spec/customer values, mutation body, CAS/idempotency and existing feature/permission gates. Dates use current locale and Europe/Rome with invalid-safe fallback.
- Product Detail runtime tests must cover flag-off Apple/inspection health, lifecycle loading/unavailable/ready/history/editor and the nested validation/pending/error/conflict/receipt/sync states in all three locales; Italian/English reject fixed employee Han except precisely registered dynamic fixture values. The same tests prove masked identifiers, cost redaction, href/allowed-actions/version/timestamp and inspection command body remain exact.
- Close the two QA P2 evidence gaps within the existing Product list test: preserve search, URL query, filter, view, focus and scroll across an in-place locale switch with no additional request; exercise Filter Sheet, view-toggle ARIA, lifecycle shortcuts, reference/no-image, active-filter live region, category-empty and filtered-empty states.
- This remediation must not enter lifecycle route screens, reservation/sale/after-sales forms, Product create/edit/form/catalog selector, server/router/API/types/query/cache/realtime/catalog data or shared UI primitives. Rerun Node 22 focused/2B-4A regressions and independent QA plus Architecture/Security at P0/P1 zero before 2B-4B closes.

### Release 2B-4B renewed-review semantic/evidence correction (2026-09-03)

- The first remediation passes its owned 23-file / 223-test packet, but expanded shared-consumer review finds two deterministic semantic regressions and incomplete Product Detail integration evidence. 2B-4B remains open; no waiver or later source slice may start.
- Preserve the established after-sales `open` employee meaning (`待检测` plus accurate Italian/English presentation) instead of the generic pending label. `InventoryConflictPanel` must respect an explicit safe caller-provided title so the after-sales dirty-draft path retains its case-specific meaning (`服务端案件已变化`) rather than replacing it with generic version copy. No canonical status/code or recovery behavior changes.
- Update only affected legacy tests whose expectations contradict the already-approved reference-alt/raw-color contract: reference accessible text composes localized fixed wrapper with original brand/model, and visible/title/ARIA color stays the original dynamic value such as `Blue`. Tests must not restore generic alt text or translated dynamic color.
- Extend the real Product Detail mounted-path matrix across zh-CN/it-IT/en for flag-off Apple/inspection health and flag-on validation, pending, generic/outcome-unknown error, receipt, conflict and post-commit sync success/failure. Italian/English reject unregistered fixed Han while canonical payload, version and idempotency remain unchanged. Directly assert Filter Sheet name/description, view-toggle `aria-pressed` and active-filter live-region output.
- Reopen only the already-owned lifecycle presentation/conflict panel, Product Detail/List tests, affected shared consumer regression tests and required message keys. No route-screen business code, API/type/query/cache/repository/catalog/schema/permission or release action is authorized.

### Release 2B-4C Quick Entry preflight contract (2026-09-03)

- This is a frozen next-slice contract only; no 2B-4C source write starts until 2B-4B passes renewed independent review. Production entry points are `/inventory?workspace=new-product`, `/inventory/new` and `/inventory/[id]/edit`, all through the existing shared intake/edit workspace and independent compact/desktop shells.
- Localize all fixed employee chrome, labels, placeholders, help, ARIA/live text, validation, Dialog/Sheet/Popover, confirmation, permission/offline/error/conflict/outcome-unknown/pending/success and recovery copy across zh-CN/it-IT/en. Brand/model/catalog/manual color and condition values, location/notes/specification, SKU/IMEI/SN/EID/GTIN, IDs, amounts, versions, route/query state and persisted/custom Unicode values remain byte-equivalent.
- Replace validation message parsing with stable validation code plus field identity; presentation maps only that stable code. Locale must not enter query keys, mutation fingerprints or request bodies. Real create/update clicks must prove exact locale-invariant payloads, `expected_version`, caller-owned idempotency behavior and exactly-once pending/success/post-commit-refresh behavior.
- Close the already-authorized disclosure-first gaps for network/version, warranty and manual supplements by reusing the existing desktop Popover/mobile Sheet/listbox primitive and value/label separation. Preserve directly visible free-text editing, Apple approved/pending-existing policy, category-aware IMEI1, visible IMEI2 and permission-gated cost. Six-width tests must prove Escape, focus return, truthful `aria-expanded`/`aria-controls`, last-option reachability, one shell and no overflow.
- Reuse the existing stable inventory error classifier/panel for timeout/Abort/5xx outcome-unknown presentation. Never infer from or expose raw provider messages. There is no automatic write retry: same unchanged command may retain its key for explicit retry/readback, changed command receives the existing new-key behavior, and conflict recovery remains explicit with draft/CAS preserved.
- Base allowlist is `src/shared/i18n/messages.ts`; Product i18n/form models and tests; create dialog, page frame, form/workspace/catalog/selectable/identifier components and direct tests; intake/edit screens and direct access/i18n tests; the existing Product Form Story. `inventory-phone-catalog-fields.tsx` may receive only optional compatible presentation props if current props cannot localize its internal chrome. Routes, Product List, API/types/query/cache/repository/schema/data/permission/flags/realtime/styles/shared UI primitives and Apple/catalog data remain forbidden.

### Release 2B-4C IMEI scanner presentation-only Delta (2026-09-03)

- The Quick Entry preflight proves `ImeiScannerField` is directly reachable and still owns fixed Chinese button, Dialog, camera, OCR, candidate, warning, error and toast copy. Treating those strings as an exception would leave the visible Quick Entry flow mixed-language, so the presentation scope expands only to `src/components/imei-scanner-field.tsx`, its direct tests and required message keys.
- The active Scanner Component Boundary Declaration remains unchanged: automatic device capture accepts only checksum-valid 15-digit IMEI through `extractValidImeiCandidates`; SN/EID/EAN/SKU/arbitrary text remain rejected automatic results; camera lifecycle, OCR/barcode choice, timeouts, formats, normalization, upload constraints, result selection and commit sources must not change.
- Implement stable/localized presentation without parsing translated strings for behavior. All dynamic candidates and manual input remain verbatim. Run the existing IMEI candidate/parser, component, camera/paste/upload and caller regression suites in addition to tri-locale UI/error/ARIA tests. Any accepted-payload widening or scanner/Order QR coupling is a stop condition for a new Owner decision.

### Full-suite deterministic test-stability Delta (2026-09-03)

- A fresh Node 22 full suite after the 2B-4B corrections exposes three nondeterministic assertions outside Inventory while their two-file cold focused run passes 60/60. This is not accepted as a retry waiver; the tests must become deterministic before the full-suite gate can be green.
- `customer-form-dialog.i18n.test.tsx` may change only the exact-identity-conflict it/en/zh assertion lifecycle so it queries the currently mounted duplicate-warning node after the transition settles and still proves the localized warning and reuse actions are visible. It must not remove locale cases, weaken identity-conflict behavior or change production source.
- `order-assistant.service.test.ts` may replace only the whole serialized-response numeric substring canary that can collide with a random request UUID. Assert explicit absence of the sensitive finance projection fields/values on the returned minimal cards while retaining exact card equality, actor-scoped repository assertions and a protected non-random sentinel. Do not seed/override UUID generation or change service behavior.
- Allowlist is those two test files only. Run focused repetition sufficient to reproduce stability, then one fresh no-retry full `npm run test`, lint/typecheck/Prettier/diff and waiver scan. No production source, skip/retry/timeout, commit, push or deploy action is authorized by this Delta.

### Release 2B-4B local closure (2026-09-03)

- Product list/detail and every Product-reachable lifecycle/shared state now render fixed employee presentation in zh-CN, it-IT and en. The established after-sales `open` and case-conflict meanings, original dynamic colors, reference brand/model/URL, Europe/Rome dates, canonical commands/status/actions, masked identifiers, cost redaction, inspection payload/CAS/idempotency and locale-without-request contracts are preserved.
- Final owned evidence passes 90 Inventory files / 725 tests, including 6 high-risk files / 174 tests and the full mounted validation/pending/error/receipt/sync/conflict, flag-off health and list accessibility matrices. Typecheck, target lint, Prettier and diff checks pass. Renewed QA PASSes with P0 0/P1 0/P2 0; renewed Architecture/Security PASSes with P0 0/P1 0 and one non-blocking legacy-fallback maintainability P2.
- Release 2B-4B is locally closed. 2B-4C source remains ordered next, but the separate two-file deterministic full-suite test Delta is executed first so later global gates start from a stable baseline. The authorized router edit-data Delta also remains pending and separate. No commit, push or deployment occurs.

### Deterministic full-suite and edit-data security closure / 2B-4C activation (2026-09-03)

- The two-test deterministic correction preserves all Customer conflict and AI sensitive-content assertions. Five cold scenario runs, the complete two files 60/60 and full Node 22 Vitest 504 files / 3788 tests pass with zero retry. Independent QA PASSes P0 0/P1 0/P2 0.
- The Owner-authorized edit-data two-file Delta now fail-closes ordinary, message-only and unknown structured repository/provider errors to the existing generic 500. Only four exact code/message/status contracts pass through; success, actor input, permissions, flags and list/get behavior remain unchanged. Router 48/48 and repository 9/9 pass; independent QA and Architecture/Security both PASS P0 0/P1 0/P2 0.
- Activate Release 2B-4C Quick Entry implementation under its frozen preflight and IMEI-scanner presentation-only contracts. One writer owns the allowed source/test/story paths; Lifecycle route screens, browser/CI, commit, push and deployment remain frozen.

### Release 2B-4C independent-review remediation Delta (2026-09-03)

- The initial Quick Entry implementation passes Node 22 focused 17 files / 320 tests and independent Architecture/Security PASSes P0 0/P1 0/P2 0, but independent QA FAILs P0 0/P1 3/P2 2. Browser evidence remains deferred to 4E; these source/runtime gaps cannot be deferred.
- Real list → create Dialog → Intake post-commit flow must have one refresh/navigation owner. Do not close/unmount before awaited parent synchronization succeeds; a parent refresh/navigation failure must leave truthful recovery UI mounted. Retrying synchronization must not repeat create, and success closes/navigates once. Permit `inventory-product-list-screen.tsx` and its directly corresponding test only for this callback ownership; all other Product List behavior remains frozen.
- Edit requires a synchronous same-tick submit lock plus explicit offline zero-write gate. Pending double submit produces one update; unchanged explicit retry preserves the existing key, changed command gets the existing new key, timeout/Abort/5xx remains safe outcome-unknown, post-commit retry synchronizes only, and conflict recovery preserves draft/latest CAS. No API or server behavior changes.
- Add real mounted `InventoryProductFormDetails/Workspace` tests for phone network/version, tablet connectivity, console edition/region, computer disk type, warranty and manual supplements in desktop Popover plus compact Sheet. Assert mounted-only controls, `aria-expanded/controls`, selection/Escape close, exact focus return, last-option reachability, always-visible verbatim free input and three-locale accessible labels.
- Close Scanner evidence P2s in its existing test only: parameterize heavy candidate/status/toast/paste/clear states across three locales and prove internal OCR/camera/raw sentinels never enter DOM or toast. Scanner recognition/candidate/camera behavior remains unchanged.
- Reopen only the exact 4C files/tests above plus required messages. Rerun Node 22 focused/Inventory/static gates and renewed independent QA plus Architecture/Security at P0/P1 zero before local closure. No browser/CI/Task Memory writer action, commit, push or deployment.

### Release 2B-4C local closure / 2B-4D activation (2026-09-03)

- Quick Entry now presents fixed employee UI in zh-CN, it-IT and en across list Dialog, direct create and edit. Eighteen stable validation codes replace Chinese-message parsing; disclosure-first covers network/version, warranty and manual supplements; Scanner chrome/errors are localized without changing checksum-valid 15-digit IMEI acceptance or capture behavior.
- Real mounted evidence proves single-owner create post-commit refresh/navigation with mounted recovery, Edit synchronous exactly-once/offline/CAS/idempotency/outcome/conflict/post-commit behavior, three-locale canonical payload equality, permission-based cost/inspection omission, Apple pending/approved behavior, locale state preservation, six-field desktop/compact disclosure accessibility and Scanner heavy-state/sentinel isolation.
- Final Node 22 evidence passes focused 2 files / 88 tests, full Inventory 90 files / 781 tests and Scanner/parser/candidate 3 files / 89 tests, with typecheck/lint/Prettier/diff/waiver gates and no act/unhandled warnings. Renewed QA and Architecture/Security both PASS P0 0/P1 0/P2 0.
- Release 2B-4C is locally closed. Activate 2B-4D for remaining production Lifecycle reservation/sale/after-sales route screens and forms only. Browser/screenshot evidence remains in 2B-4E; no commit, push or deployment.

### Release 2B-4D Lifecycle preflight and immutable command contract (2026-09-03)

- Production scope is reserve/sell, reservation/sale detail, after-sales queue and case. Fixed employee chrome, field labels, accessible names/live regions, validation, loading/empty/error/permission/stale/conflict/outcome-unknown/pending/success/receipt/consequence and known stable-code labels become zh-CN/it-IT/en. Customer/SKU/issue/diagnosis/reason/note/history/custom/unknown values stay verbatim; dates use current locale + Europe/Rome with invalid-safe fallback, money uses current locale EUR without numeric change.
- Preserve the nine currently reachable canonical commands exactly: `reservation.create`, `payment.append`, `sale.complete`, `pickup.confirm`, `reservation.cancel`, `warranty.adjust`, `after_sales.create`, `after_sales.update`, `after_sales.close`. Routes, endpoint/query roots and store scoping, payload fields, `allowed_actions`, CAS versions and caller-owned UUIDs do not change. Timeout/Abort/5xx remains write lock → readback → explicit user decision; never automatic mutation replay.
- `/inventory/[id]/sell` is the existing staged flow whose first command is still `reservation.create`. Employee copy must truthfully say that it creates the reservation/sales record before later payment/completion; it may not claim the initial click completes the sale or substitute `sale.complete`.
- Reservation customer search must be a real localized combobox/listbox with keyboard active-option/Escape behavior, safe loading/empty/error states, selected-customer proof and no full-phone leakage. Local validation populates the existing `ValidationSummary`, focuses real fields and prevents mutation. Query key/store scope/API result shape remain unchanged.
- Every mutation surface requires a synchronous submit lock, offline zero-write guard where applicable, stable safe-error presentation, unchanged/changed-command idempotency evidence, CAS conflict preservation, explicit recovery, receipt/replay and post-commit synchronization proof. Real tri-locale clicks deep-compare canonical bodies after normalizing only valid UUID/controlled time fields.
- Security preflight identifies one additional P1: reservation outcome readback rejection can escape `InventoryOperationErrorPanel` as an unhandled Promise. Consume rejection at the action boundary after caller state transitions, preserving lock/draft/key and safe failure UI; do not change readback or mutation behavior. Direct and mounted tests must prove zero raw sentinel and zero unhandled rejection.
- Deferred P2s remain explicit and unchanged: lifecycle realtime does not invalidate `inventoryLifecycleKeys` cross-device; after-sales shell lacks exact capability projection; customer search uses an ad-hoc store-scoped key and over-broad response; legacy preload mismatch; production database/RPC enablement is not proven by this source release. Do not claim these closed or modify API/types/query/cache/realtime/permissions/server/schema/data/flags/startup.

### Release 2B-4D independent-review remediation Delta (2026-09-03)

- The first implementation passes Node 22 lifecycle/shared 16 files / 185 tests and full Inventory 90 files / 811 tests, but independent QA FAILs P0 0/P1 4 and Security adds one presentation-fidelity P1. 2B-4D remains open; no 4E/browser or later release work starts.
- Customer combobox Escape from input or option must close/unmount the listbox, set accurate ARIA, preserve the search draft, restore exact input focus and trigger no extra search/mutation. Add tri-locale ready plus loading/empty/safe-error and last-four-only/full-phone-absent proof.
- Interpret reservation `datetime-local` as a Europe/Rome wall time independently of host timezone. Reject invalid, nonexistent spring-gap and ambiguous autumn-overlap values with localized validation and zero mutation; valid boundary values produce the same canonical ISO under UTC, Europe/Rome and America/New_York test processes. Do not add an offset selector or silently choose an ambiguous instant.
- Bind idempotency keys to a stable canonical `{command,payload}` fingerprint on reservation, sale and after-sales surfaces. An unchanged explicit retry may reuse its key; changed body, changed command, successful readback followed by a new decision and update→close must receive a new key. Preserve CAS, explicit locking, no automatic replay and existing server ledger behavior.
- Add real mounted locale-switch evidence preserving route/query/search/form draft/focus/dynamic values/CAS/current key with zero new read/write; real after-sales QueueScreen permission/loading/error/retry/empty/ready three-locale states; and reservation offline zero-write/same-tick one-request evidence.
- Every server-derived stable-code lookup in 4D must localize known values and fall back to the exact raw runtime value. Audit queue/case/editor status, sale payment kind/method and coverage; unknown coverage must not become `pending`, and no unknown/custom value may render blank. Add real tri-locale future/custom sentinel tests while preserving option/command/payload values.
- Reopen only existing 4D allowed sources/tests and message keys. No API/type/query/cache/repository/schema/permission/realtime/flag/startup/catalog or production-data change. Rerun full Node 22 Inventory/static gates and renewed QA plus Architecture/Security at P0/P1 zero before 4D closure.

### Release 2B-4D local closure / 2B-4E activation (2026-09-03)

- The Lifecycle reservation/sale/after-sales slice is locally closed. Fixed employee presentation is localized across zh-CN, it-IT and en while all nine canonical commands, payload fields, CAS versions, store scoping and the staged `/sell` `reservation.create` behavior remain unchanged.
- Reservation `datetime-local` is interpreted as Europe/Rome wall time independently of the host timezone. Invalid calendar values, the spring DST gap and autumn DST overlap fail closed with localized validation and zero mutation. Real mounted canonical submission passes under UTC, Europe/Rome, America/New_York and Asia/Shanghai.
- Reservation, sale and after-sales idempotency keys are bound to stable canonical `{command,payload}` fingerprints: identical explicit retries preserve the key, changed body/CAS/command rotates it, and success/readback/conflict recovery retires the previous attempt without automatic replay. Real mounted evidence covers reservation locale preservation and after-sales update-to-close rotation.
- The customer combobox closes correctly with Escape from the input or option, restores exact focus, exposes only masked last-four phone data and preserves search state. Real screen tests cover locale switching, queue permission/loading/error/retry/empty/ready, offline/same-tick guards, safe error containment and exact raw fallback for future status/coverage/payment values.
- Final Node 22 evidence passes focused lifecycle/shared 23 files / 258 tests, full Inventory 90 files / 838 tests, shared i18n 4 files / 13 tests, typecheck, ESLint, Prettier, diff and waiver scans. Renewed QA and Architecture/Security both PASS with P0 0/P1 0. QA records one new non-blocking P2 for a dedicated customer-search loading assertion; the five existing deferred P2s remain unchanged.
- Activate 2B-4E as the strict browser/CI and screenshot packet for all ten Inventory Product/Lifecycle production routes. It must cover zh-CN/it-IT/en at 390/430/768/1024/1280/1440 in Chromium and WebKit, include the customer-search loading state, enforce console/page-error/request/write gates with synthetic or masked data, and produce `screenshots/release2b4/{chromium,webkit}` evidence. No commit, push or deployment occurs until the entire ordered release remains green.

### Release 2B-4E menu-focus interpretation and continued browser contract (2026-09-03)

- Chromium correctly exposed that the first heavy test expected the pre-menu Quick Entry input to regain focus after selecting a locale through the real AppBar language menu. One bounded QA/Security cross-question resolves this as an evidence-contract error, not a product defect: an action/menu selection predictably closes back to the visible language menu trigger, consistent with the existing Radix close-auto-focus behavior and WAI-ARIA menu-button interaction. Do not change shared `LanguageSwitcher` or add arbitrary prior-element focus restoration.
- The real AppBar test must assert exact visible language-trigger focus after each successful selection while preserving route, URL/query, Quick Entry draft, scroll and zero additional business reads/writes. Existing direct LocaleProvider rerender tests remain the evidence for preserving field/option focus and open disclosure state when focus never intentionally enters another control.
- Do not claim an open Inventory disclosure remains open after the user intentionally enters a different AppBar menu. Correct the heavy case title/assertions to the behavior it actually exercises, and separately keep real disclosure mount, last-option reachability, Escape close and exact trigger-focus browser evidence.
- Continue 4E with the still-required real high-risk browser states: permission-limited redaction, loading/empty/error, offline/invalid zero-write, pending/exactly-once, CAS conflict, outcome-unknown/readback and post-commit sync/recovery. All reads remain fully synthetic; every allowed write is intercepted and locally fulfilled with exact method/path/body checks.

### Release 2B-4E screenshot-review remediation and Apple evidence boundary (2026-09-03)

- The first complete Chromium/WebKit packet passes 20/20 per engine, but independent screenshot review finds a real desktop lifecycle-header defect at 1024/1280/1440: when the entity-context AppBar back control makes the page-local back button `lg:hidden`, the shared three-column mobile header grid auto-places the title into the hidden button's 36px column. Italian titles visibly truncate to one letter. Reopen only `inventory-lifecycle-page-shell.tsx`, its direct test and the existing 4E spec/screenshots for a responsive grid correction. Preserve the mobile three-column layout, AppBar navigation ownership, routes, title/context/status data and all business behavior.
- Direct and browser acceptance requires the desktop entity-context shell to use the remaining flexible title/status columns, render the complete title at 1024/1280/1440 in all locales and preserve the current mobile/tablet composition. Rerun the full zero-retry Chromium/WebKit packet and renew QA/Security review; no style-token or shared UI primitive change is allowed.
- The original 4E phrase “Apple approved/pending” is clarified by the production access contract: Product Intake/Edit deliberately do not inject an `approvedAppleColorOverlay`, because no reviewed official per-model color manifest is authorized. Production-route browser evidence must therefore prove the truthful pending state for known and manual/unknown Apple models and must not fabricate an approved overlay. The approved branch remains covered by the already-passed real mounted component/form tests and Story evidence with a local explicit overlay. Introducing catalog approval data, a test-only production query flag or a new production capability would violate the frozen data boundary and is not required for 4E closure.

### Release 2B-4 final local closure / 2B-5 activation (2026-09-03)

- Release 2B-4 Inventory Products/Lifecycle is locally closed. The final screenshot remediation gives desktop entity lifecycle headers a flexible title/status grid without changing mobile/tablet or collection layouts, and lets Quick Entry action labels wrap without overlap while retaining the two-column action order, readable type and minimum 44px targets.
- Final browser evidence passes Chromium 20/20 and WebKit 20/20 with retries zero. Each engine records 180 ten-route × locale × width route screenshots plus four high-risk screenshots, exactly 184 per engine and 368 total under `screenshots/release2b4`. Independent QA reruns both engines at six Italian visual subsets each and confirms no missing/extra/bad images, clipped lifecycle titles or overlapping Quick Entry actions.
- Final direct evidence passes two files / nine tests plus typecheck, target ESLint, Prettier, diff and waiver scans. QA and Security both PASS P0 0/P1 0/new P2 0. The five previously registered deferred Inventory P2s remain explicit; production Apple routes remain truthfully pending while the approved overlay branch is covered by mounted component evidence only.
- Activate Release 2B-5 for the current production Transparent Buyback surface. Begin with read-only route/UI/business-boundary/locale and test audit, then freeze a minimum tri-locale implementation and verification packet. Preserve valuation formula inputs, evidence/consent/customer/device values, record/persistence payloads, permissions, store scoping and legal/customer-facing output; no commit, push or deployment until 2B-5 and 2B-6 both close.

### Release 2B-5 Transparent Buyback frozen contract (2026-09-03)

- The only production route is `/buyback` → `features/buyback/index.ts` → `screens/transparent-buyback-screen.tsx`. It is a quote-only flow: list, create quote, revise quote and record an employee-observed verbal customer response. The unexported legacy `buyback-screen.tsx` and `buyback-quote-workspace.tsx`, evidence/identity/signature/payment/finalize/inventory handoff and WhatsApp/print paths remain unreachable and forbidden.
- Localize fixed employee list/search/filter/summary/card/detail/history/workspace/form/validation/ARIA/toast/loading/empty/error/offline/permission/pending/success/conflict/recovery presentation into zh-CN, it-IT and en. Dates and money use the active locale and Europe/Rome with invalid-safe fallback. Known filter/outcome/reject-reason/risk/revision/deduction codes use stable presentation mappings; unknown/custom values and persisted deduction labels fall back verbatim.
- Preserve all dynamic and canonical data byte-for-byte: public numbers, raw brand/model/color/storage, masked identifiers, customer/employee names, response notes, manual adjustment and revision reasons, history text, canonical outcome/reason/risk/hard-block/deduction codes, amounts, timestamps, CAS `expected_updated_at`, revision IDs and idempotency keys. The persisted Chinese deduction labels and default `重新检测后更新报价` remain request/ledger data and must not be translated before submission. Italian legal body/version/hash/language and all dormant customer-facing output remain untouched.
- Restore the established `/buyback?new=1`, `?q=`, `?id=` and `?record=` intent behavior and the global buyback scan-search intent within the active screen, preserving exact query/filter/payload behavior. Closing the `new=1` workspace returns to `/buyback`; locale changes must not navigate, refetch, close sheets or clear search/filter/draft/selection/history/focus/current CAS or current idempotency attempt.
- Add store-shell loading/no-store/read-denied fail-closed states and `enabled:Boolean(storeId)` read gating without changing the server permission matrix or API/query shape. Role affordances remain a presentation optimization only; server authorization remains authoritative. Stale data survives background refresh failure with a safe warning. Every form control receives a stable localized accessible name/label; validation uses stable local codes, a visible summary and first-error focus/`aria-invalid` with zero mutation.
- Unknown mutation/provider errors are reduced at the active UI boundary to stable localized safe messages using status/code/name only; never render raw `message`, `details`, stack, request IDs or sentinel content. Preserve explicit 409/CAS recovery semantics. A synchronous lock and canonical `{operation,payload}` fingerprint must prove one same-tick write, same-body explicit retry with the same key, changed body/CAS/operation with a new key, and unknown outcome readback before any explicit retry. Do not change endpoints, request/success shapes, server behavior or ledger semantics.
- Minimum implementation allowlist for 2B-5A/B: `src/shared/i18n/messages.ts`; new `src/features/buyback/model/buyback-i18n.ts` and direct test; `src/features/buyback/screens/transparent-buyback-screen.tsx` and new direct i18n/runtime test. 2B-5C may add `tests/e2e/i18n-buyback-release-2b5.spec.ts`, exact CI inclusion and `screenshots/release2b5/{chromium,webkit}`. Existing Chinese E2E may receive expectation-only compatibility updates if production zh text intentionally changes, but cannot replace the strict release spec.
- Forbidden without a new Owner-approved Delta: Buyback API/query keys/types/router/repository/schema/permissions/realtime/migrations/env flags; Apple guide/quote/agreement/evidence/workflow models; the dormant legacy screen/workspace; scanner/camera parsing; customer/inventory product/payment/upload/finalize; legal/WhatsApp/print/customer-facing output; production data or environment changes.

### Release 2B-5 security stop and proposed sensitive-text Delta (Owner decision required)

- Current server validation rejects long numeric identifiers but accepts some complete alphanumeric document tokens such as `YA1234567` in `manual_adjustment_reason` or `response.note`, which are written to an append-only ledger while the product states that sensitive identity collection is disabled. Client hints cannot close this boundary.
- This finding blocks total 2B-5 closure but does not block the presentation-only 2B-5A/B/C work above. Before any server correction, obtain explicit Owner confirmation for a separate bounded Delta: new `features/buyback/model/buyback-sensitive-text.ts` plus test; `server/api/repairdesk-schemas.ts` plus direct test; active screen validation/tests/messages; existing 2B-5 E2E verification only.
- Proposed compatibility contract: no endpoint/request/success/schema/permission/CAS/idempotency changes; only future create/revise/respond inputs receive high-confidence fail-closed detection for normalized phone, 15-digit IMEI, email, URL and explicitly approved Italian document formats including separated/full-width variants. Validation uses an NFKC/Unicode shadow only and preserves accepted original text; normal zh/it/en business reasons, dates, amounts and product models remain accepted. Rejected content never appears in errors/logs. Existing ledger rows are not scanned, rewritten or backfilled.
- If the Owner requires a universal guarantee across arbitrary document formats/scripts, stop and propose structured reason codes or removal of free text as a larger product/API/legal/retention project. Rollback of the narrow validator would reopen PII writes, so an operational rollback must also disable transparent-quote writes.

### Release 2B-5 acceptance and retained risks

- Node 22 tri-locale mounted tests must cover all fixed employee UI, deep-equal create/revise/respond bodies, formula/money fidelity, Europe/Rome dates, dynamic/unknown passthrough, store/role states, safe errors, validation/focus, locale preservation, exactly-once/idempotency/CAS/conflict/outcome/readback/sync and quote-only negative paths.
- Strict Chromium and WebKit each cover zh-CN/it-IT/en at 390/430/768/1024/1280/1440 through list → filled workspace → detail plus high-risk loading/empty/filter/error/permission/offline/invalid/pending/conflict/outcome/history/success/locale-switch states. Synthetic reads only; exact loopback origin/method/path/body; allowed writes locally fulfilled; all unknown/external/sensitive endpoints aborted; no full phone/IMEI/document/image/signature/hash/internal cost in DOM/console/trace/screenshots.
- Existing P2s remain explicit: same-store sensitive-search existence oracle, response lost-result/new-key duplication risk, mock/production projection mismatch, role-string affordance drift, and the 1,423-line active screen structural debt. Dormant sensitive workflow legal/RPC version mismatch and stale Apple pricing are release blockers only before any future reactivation, not for the current quote-only flow.

### Release 2B-5A local closure / 2B-5B activation (2026-09-03)

- The production quote-only screen now has 163 parity-checked message keys per locale and stable adapters for known Buyback codes, safe errors, Europe/Rome dates and active-locale EUR. All reachable fixed employee UI, ARIA, validation, loading/empty/error/offline/store/permission/stale states and deep-link/scan intent presentation are localized in zh-CN, it-IT and en.
- Live and scanned sensitive search values remain local-only; `?q=` is a one-way inbound intent and no user/scan value is written to the URL. The real IMEI scanner receives localized input/action identity. Programmatic locale switching preserves URL/search/dialog/draft/focus and causes zero read/write/navigation.
- Workspace, selection, list cache partition and write affordances are bound to the complete store-shell `authorityFingerprint`, not only store ID. Render-time ownership guards plus layout-phase cleanup close A→no-authority→B, same-store role downgrade and membership replacement without transient old DOM or stale read/write. Locale does not alter authority.
- Final Node 22 evidence passes Buyback 9 files / 99 tests, expanded Buyback/API/router/schema/permission/mock 17 files / 276 tests, real Scanner 42 tests, typecheck, target lint, Prettier, diff and waiver scans. Renewed QA and Security both PASS P0 0/P1 0/new P2 0. No browser evidence belongs to this slice.
- Activate 2B-5B within the same active screen/tests/messages only. Complete synchronous locks and canonical operation/payload fingerprints for create, revise and respond; same-body explicit retry reuses the key, changed body/CAS/operation rotates it, 409/readback and unknown outcome remain explicit with no automatic replay, and success/invalidation/sync recovery never duplicate a write. Keep the server sensitive-text stop open and do not enter its unapproved files.

### Release 2B-5 sensitive-text Delta Owner authorization (2026-09-03)

- The Owner replied `确认` after the frozen sensitive-text Delta and its stop condition were presented. Treat that response as explicit authorization for the narrow future-input validator Delta recorded above.
- Authorization is limited to the named model helper and test, Buyback schema and direct test, active Transparent Buyback validation/tests/messages, and existing 2B-5 browser verification. It does not authorize endpoint, response, database schema, migration, permission, CAS, idempotency, historical-ledger backfill, production-data, legal/customer-output, dormant-workflow, commit, push or deployment changes.
- Execute only after the active 2B-5B screen writer freezes its work, so the same screen/messages remain under one writer at a time. Accepted original text must remain byte-for-byte; matching uses only an NFKC/Unicode shadow and rejected values must never be echoed in UI, errors or logs.

### Release 2B-5B final local closure / sensitive-text Delta activation (2026-09-03)

- Create, revise and respond now use synchronous locks and canonical operation/payload fingerprints. Ambiguous revise success requires a successful pre-submit history baseline, a new revision ID and exact canonical quote snapshot plus exact change reason; response success requires a successful baseline, new response ID and exact revision/outcome/reason/note. Timestamp-only, competing, missing, failed or baseline-less reads remain explicitly unknown and locked.
- Authority replacement guards run before any late error state, toast or readback. Strict 409 refresh propagates errors and unlocks only after the exact target projection is present. Readback-pending, offline and post-commit sync-only paths prove zero duplicate writes.
- Node 22 evidence passes Buyback 9 files / 137 tests and expanded Buyback/API/router/schema/permission/mock 17 files / 314 tests plus typecheck, ESLint, Prettier, diff and waiver gates. Renewed independent QA and Security both PASS P0 0/P1 0/new P2 0.
- Activate the Owner-authorized sensitive-text Delta as the next single-writer slice. Do not alter the frozen mutation-recovery semantics while adding future-input validation. No browser, commit, push or deployment yet.

### Release 2B-6 read-only production audit / preflight (2026-09-03)

- Production scope is fixed by actual routes and exports: `/settings` including `/settings/closed-stores`; `/messages`; `/finance`; `/memos`; flag-gated `/toolkit`; `/platform`; `/account`; and the global AI Assistant provider/sheet/result/usage/voice surfaces. `memos/components/memo-table.tsx`, unused barrels, fixtures, workers and non-exported screens are not production evidence.
- Baseline Node 22 evidence passes 107 scoped feature files / 625 tests plus eight shared/router files / 73 tests, 115 files / 698 total. This is only a pre-change baseline and does not satisfy tri-locale/browser acceptance.
- P0 is zero. Seven blocking P1 classes are frozen: large fixed-Chinese it/en gaps including new AI response metadata; authority-sensitive Toolkit/Platform caches; raw provider/database diagnostics reaching UI; Memos due-time host-timezone semantics; a Platform approve affordance whose policy/server path is permanently disabled; Finance mobile five-column clipping; and missing production-screen/tri-locale/six-width dual-engine evidence.
- Preserve dynamic/user/persisted values, customer-facing message templates/default Italian bodies, rendered previews, message signatures, print footers, export rows/files, store/supplier/member/memo/account data, AI prompts/transcripts/existing responses/evidence, toolkit files/secrets/URLs, Platform notes and all canonical codes, routes, queries, store scope, permissions, CAS, idempotency and continuation fields. Locale may affect only presentation and the already-existing locale field for newly submitted AI turns.
- Presentation implementation remains serial because `src/shared/i18n/messages.ts` is shared. Candidate slices are Settings shell/core and reachable sections; Messages; Finance with the same-screen responsive table correction; Memos presentation; Toolkit; Platform; Account; and AI client presentation plus a separately reviewed server-owned presentation adapter for future responses. Dead code remains excluded.
- The authority-cache correction, broad raw-error server boundary, Rome due-at business semantics, disabled Platform approve action and AI server-owned response localization require separate frozen deltas before their non-presentation files are changed. This preflight records the findings but grants no API/schema/migration/permission/production-data/commit/push/deploy authority.

### Release 2B-5 sensitive-text Delta final local closure / 2B-5C activation (2026-09-03)

- The Owner-authorized validator now protects every append-only free-text entry in active Transparent Buyback: deduction labels, manual adjustment reasons, revise change reasons and response notes. The dedicated `device.serial_or_imei` identifier field remains exempt and unchanged.
- Classification uses a detection-only NFKC shadow, a narrow default-ignorable allowlist and approved Unicode whitespace/dash plus `/ . _` separator normalization. It recognizes high-confidence validated phone and IMEI candidates, email, explicit URL, official Italian CIE `2 letters + 5 digits + 2 letters`, the documented passport `2 letters + 7 digits` shape and strongly labelled code-like document tokens. Shadow text never enters payloads; existing trim/btrim behavior is unchanged.
- Bounded token parsing prevents tailing dates/text, phone-plus-amount, invalid 15/16-digit identifiers and ordinary zh/it/en document prose from being misclassified. Client validation is tri-locale, focuses and marks the field, writes nothing and never echoes rejected input. Server schemas remain authoritative before repository calls.
- Final Node 22 evidence passes focused four files / 239 tests, full Buyback ten files / 240 tests and server API eleven files / 171 tests plus typecheck, ESLint, Prettier, diff and waiver gates. Independent QA PASS P0 0/P1 0/P2 0; independent Security PASS P0 0/P1 0/new P2 1.
- Retained P2: an all-uppercase natural sentence immediately after a document label can be conservatively rejected; unsupported international/script formats are not a universal DLP guarantee; existing append-only history is neither scanned nor rewritten. Activate strict synthetic 2B-5C browser evidence. Never screenshot or trace a filled sensitive-rejection state.
