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
updated_at: "2026-09-01T09:57:00Z"
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

- [ ] Kiosk fixed-Italian contract is consistent across metadata, visible UI, accessibility names, validation and public-safe failures; `/r` and employee locale Cookie isolation remain unchanged.
- [ ] Automatic CI triggers on all locale/switcher/layout/provider/auth/Kiosk and release-domain paths, executes both foundational and release i18n specs in Chromium/WebKit, and cannot report a pass when required environment/setup is absent.
- [ ] The audit covers production-reachable `.tsx` and `.ts` UI/error sources, classifies legacy/dynamic/customer/legal exceptions and provides reproducible per-domain residual counts.
- [ ] Public 404, same-page title and `/r` duplicate-brand metadata defects are fixed; public-auth failures expose inline accessible error/retry states without changing auth semantics.
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

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
- The phrase “language switching complete” remains separate from “full reachable fixed UI translated”; the final claim must be backed by the final classified audit and browser evidence.
