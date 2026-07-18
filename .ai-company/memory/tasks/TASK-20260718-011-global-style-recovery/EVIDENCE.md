# Evidence

## Pre-implementation

- User screenshot: mobile Chrome displayed unstyled AppSidebar, AppBar and settings content together.
- `src/app/layout.tsx`: one global CSS import and no style-readiness guard.
- `public/sw.js`: network-first navigation; only `/offline` and icon are cached.
- Production `/_next/static/*.css`: HTTP 200, immutable one-year cache, and runtime Google Fonts `@import` at the first line.
- Browser lifecycle sources: Chrome documents hidden pages being frozen/discarded and recommends checking restoration through `resume`, `pageshow` and visibility state.

## Validation

### Acceptance matrix

| Criterion                                                 | Result | Evidence                                                                                                                 |
| --------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| Normal CSS shows the app without a recovery overlay       | PASS   | In-app browser at 390x844 and 1440x900; marker `1`, fallback `display:none`, shell `display:contents`                    |
| Missing CSS never exposes raw app DOM                     | PASS   | Chromium and WebKit forced-CSS-failure E2E; shell hidden on mobile and desktop                                           |
| Background/resource recovery reloads once without a loop  | PASS   | Chromium and WebKit one-reload E2E with a 30-second session cooldown                                                     |
| Browser has no runtime Google Fonts stylesheet dependency | PASS   | production build artifact search found no `fonts.googleapis.com` or `fonts.gstatic.com`; local `.woff2` assets generated |
| Scoped regression                                         | PASS   | 4 helper tests + 2 PrintPortal tests; typecheck; full lint; production build                                             |
| Repository-wide unit suite                                | PASS   | Latest `origin/main` integration: 278 test files and 1776 tests passed                                                   |

### Commands and results

- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npx vitest run src/shared/lib/app-style-recovery.test.ts src/features/orders/components/print-portal.test.tsx`: PASS, 6 tests.
- `npm run build`: PASS with Next.js 16.2.6 after allowing build-time font download.
- Chromium targeted E2E: PASS, 3 tests.
- WebKit targeted E2E: PASS, 3 tests.
- `npm run test`: PASS on latest `origin/main`, 278 files and 1776 tests.
- `git diff --check`: PASS.

### Visual evidence

- `screenshots/TASK-20260718-011-global-style-recovery/mobile-login-styled.jpg` — production build at 390x844.
- `screenshots/TASK-20260718-011-global-style-recovery/desktop-login-styled.jpg` — production build at 1440x900, no horizontal overflow.
- `screenshots/TASK-20260718-011-global-style-recovery/mobile-login-production.jpg` — public production authentication page at 390x844; marker `1`, fallback hidden, no horizontal overflow.
- `screenshots/TASK-20260718-011-global-style-recovery/desktop-login-production.jpg` — public production authentication page at 1440x900; marker `1`, fallback hidden, no horizontal overflow.

### Release verification

- GitHub `refs/heads/main`: `45d4b6697328a4bfd987d7da2598c45f908a011a` immediately after the feature push.
- Vercel deployment: `dpl_8p27HyeyuazzCykGSF4tfaRGbbrp`, target `production`, state `READY`, Git commit `45d4b6697328a4bfd987d7da2598c45f908a011a`.
- Public domain: `https://chinatech.in` redirected to `https://www.chinatech.in`; the login HTML returned HTTP 200 with `repairdesk-critical-style-guard`, `repairdesk-style-fallback` and `repairdesk-styled-shell`.
- Public CSS: contained `--repairdesk-styles-ready:1`, used local `../media/*.woff2` assets, and contained no `fonts.googleapis.com` or `fonts.gstatic.com` references.
- The earlier conditional full-suite result was superseded after the repair commit was integrated on top of current `origin/main`, where the full suite passed.

### Documentation sync

- User-facing operation and API contracts are unchanged, so no public manual/API document update is required.
- Recovery behavior, trigger events, test matrix and rollback are documented in this task archive and executable tests.
- The existing UI declarations remain authoritative; no design-system token or page-generation rule changed.

### Capability review

- Evidence supports a C1 candidate for root-layout stylesheet failure diagnosis and cross-engine verification.
- No capability, permission or autonomy upgrade was made from a single task.
- `2026-07-18T18:03:54Z` `4e82b0e4fe` — lint/typecheck/build 通过；278 个测试文件、1776 个测试通过；Chromium 3/3、WebKit 3/3；chinatech.in 样式标记为 1。
