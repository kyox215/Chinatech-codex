# Checkpoints — TASK-20260831-001-project-i18n-clean-rebuild

## 2026-08-31T10:02:00Z — Clean-baseline execution contract

- **Phase:** context_ready / planned; source writes not started.
- **Done:** Owner-authorized destructive cleanup completed; canonical `main` clean and exactly equals freshly fetched `origin/main` at `eb45cc65507445292c572c514576715bfffa05aa`. New Registry/task/run/window initialized and bound to main-thread Integration Lead. T3/R3/L2 contract, acceptance, release boundaries and single-writer rule recorded. Two independent read-only audits are active: current-code map and architecture/UX.
- **Remaining:** issue/verify immutable Context Packet; merge audits into a final file allowlist; implement WP1–WP4; run final R3/browser/independent review; acquire/reverify integration lease; commit, non-force push, Vercel deploy, smoke/observe/closeout.
- **Blocked:** no source blocker. Production GO remains blocked until exact-SHA quality, GitHub/Vercel and rollback evidence exists.
- **Next:** issue Context Packet, inspect current clean baseline, freeze WP1 allowlist and begin the single implementation milestone.
- **Budget:** current milestone = WP1 foundation + shell; soft 45m, hard 90m, max two concurrent read-only agents, cumulative wait <=20m.

## 2026-08-31T10:20:00Z — Fresh-baseline architecture frozen

- **Phase:** implementation / WP1 foundation and global shell.
- **Done:** immutable Context Packet issued and hash verified; both clean-baseline read-only audits completed. Selected design is typed in-repo `zh-CN`/`it-IT`/`en` dictionaries, strict locale allowlist, server Cookie resolver, client LocaleProvider and shared Rome/EUR formatters. No i18n dependency will be added.
- **Boundaries:** language switching must not reload, navigate, refresh, remount QueryClient/routes, invalidate business queries or alter tenant/permission/API payloads. Customer communication language and Italian customer print documents remain separate business concepts. Service worker must not cache Cookie-localized application HTML.
- **UX contract:** self-named language options, radio-menu semantics, keyboard/focus support, 44px targets, one polite status announcement and mobile-safe menu width. Cookie failure keeps the selected in-memory locale for the session and reports persistence failure.
- **Remaining:** implement foundation/shell/auth/public and feature-domain dictionaries; migrate metadata/offline/control text; add unit/browser coverage; close the string inventory; run R3 gates and release workflow.
- **Blocked:** none for implementation. A dependency, schema/profile-locale, customer-print-language or deployment-target change would require fresh Owner approval.
- **Next:** create the foundation modules and shared switcher, then wire RootLayout/Providers and shell surfaces before domain migration.

## 2026-08-31T10:55:00Z — WP1 build-proven milestone

- **Phase:** implementation / WP2 page-domain migration.
- **Done:** exact locale allowlist, Cookie parser/persistence, SSR locale resolver, typed equal-shape catalogs, provider, language radio menu and Rome/EUR formatters implemented. Root metadata, `html lang`, recovery fallback, manifest, service-worker offline fallback, global Shell, auth entry/recovery/registration, primary module headers and mobile orders header now consume the selected locale. Invalid/blocked Cookie behavior and in-place state preservation have focused tests.
- **Architecture evidence:** production build succeeds with all application routes intentionally marked dynamic because RootLayout reads the locale Cookie. No new dependency, API, schema, tenant, permission or query-cache behavior was introduced. PWA cache moved from shell v4 to v5 after localized offline fallback change; navigation remains network-first and Cookie-localized HTML is not cached.
- **Customer-language boundary:** `/r`, Kiosk, customer communication fields and Italian customer print documents remain separate from employee UI locale. Their language selector is intentionally hidden until their distinct business-language contract is approved.
- **Quality evidence:** focused ESLint passed; focused Vitest 26/26 passed; Node 24 production build passed. Initial sandboxed build failed only because Google Fonts network was blocked; the authorized network build passed.
- **Remaining:** translate remaining high-value domain controls/states and remaining route metadata, add language switcher browser/state/a11y tests, close explicit UI inventory exceptions, run full R3 gates and screenshots, then release.
- **Next:** finish domain-control and route-metadata migration, then add end-to-end locale/state/overflow coverage.
## 2026-08-31T11:36:37Z — Core zh-CN/it-IT/en locale foundation, strict Cookie SSR, in-place language switcher, shell/navigation, public auth/invite/onboarding, localized metadata/manifest/offline recovery, primary module entry text, Rome/EUR formatters, AI locale propagation, tests, screenshots and architecture documentation are implemented on fresh origin/main baseline. Scope is corrected to the Owner-requested website language capability rather than a false claim that every historical domain string is translated.

- **Phase:** quality_gate
- **Completed/current state:** Core zh-CN/it-IT/en locale foundation, strict Cookie SSR, in-place language switcher, shell/navigation, public auth/invite/onboarding, localized metadata/manifest/offline recovery, primary module entry text, Rome/EUR formatters, AI locale propagation, tests, screenshots and architecture documentation are implemented on fresh origin/main baseline. Scope is corrected to the Owner-requested website language capability rather than a false claim that every historical domain string is translated.
- **Next:** Finish full R3 lint/typecheck/test/build and Chromium/WebKit browser checks; obtain final QA/security/release reviews; acquire integration lease; commit, non-force push exact SHA, deploy existing Vercel project and verify production.
- **Decision:** Release unit covers core interface language capability and explicitly inventories deep-domain historical text for later migration; customer communication and fixed Italian print language remain separate.
- **Evidence:**
  - Node 24 typecheck passed after final auth/onboarding changes; prior focused lint/tests, production build and 3/3 i18n Playwright passed; final exact-SHA gates remain pending.
- **Recorded by:** Integration Lead

## 2026-08-31T13:05:00Z — Release candidate quality and independent review complete

- **Phase:** release_ready.
- **Done:** final source passes Node 24 lint, typecheck, 466 files / 3,071 Vitest tests, agent rules and optimized production build. Chromium and WebKit each pass 9/9 i18n E2E, including customer-route Cookie isolation, auth-confirm/offline in-place updates, real keyboard/focus/scroll behavior, and sanitized Shell evidence. Security conditions are closed; final Architecture/UX/Release review is PASS/GO with zero blocker/major.
- **Scope:** release claim remains core zh-CN/it-IT/en capability with principal Shell/Auth/public-entry coverage and tested formatter foundation. Deep historical domain strings and formatter consumption remain an explicit follow-up, not a full-site translation claim.
- **Release controls:** freshly fetched `origin/main` still equals baseline `eb45cc65507445292c572c514576715bfffa05aa`; integration lease v1 is held by the bound Integration Lead. Existing Vercel rollback anchor is `dpl_AvyKuvhGqkhyjo9sGtc34b3kgPre` (Ready production).
- **Next:** freeze staged diff, commit, reverify exact-SHA gates and lease, non-force push, verify existing Vercel production deployment/aliases/smoke/logs, then consolidate memory and close.
