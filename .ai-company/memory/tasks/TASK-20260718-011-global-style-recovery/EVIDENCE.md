# Evidence

## Pre-implementation

- User screenshot: mobile Chrome displayed unstyled AppSidebar, AppBar and settings content together.
- `src/app/layout.tsx`: one global CSS import and no style-readiness guard.
- `public/sw.js`: network-first navigation; only `/offline` and icon are cached.
- Production `/_next/static/*.css`: HTTP 200, immutable one-year cache, and runtime Google Fonts `@import` at the first line.
- Browser lifecycle sources: Chrome documents hidden pages being frozen/discarded and recommends checking restoration through `resume`, `pageshow` and visibility state.

## Validation

### Acceptance matrix

| Criterion | Result | Evidence |
| --- | --- | --- |
| Normal CSS shows the app without a recovery overlay | PASS | In-app browser at 390x844 and 1440x900; marker `1`, fallback `display:none`, shell `display:contents` |
| Missing CSS never exposes raw app DOM | PASS | Chromium and WebKit forced-CSS-failure E2E; shell hidden on mobile and desktop |
| Background/resource recovery reloads once without a loop | PASS | Chromium and WebKit one-reload E2E with a 30-second session cooldown |
| Browser has no runtime Google Fonts stylesheet dependency | PASS | production build artifact search found no `fonts.googleapis.com` or `fonts.gstatic.com`; local `.woff2` assets generated |
| Scoped regression | PASS | 4 helper tests + 2 PrintPortal tests; typecheck; full lint; production build |
| Repository-wide unit suite | CONDITIONAL | 1487 passed, 5 failed in already modified `src/features/stores/server/store.repository.test.ts`; fixtures are expired relative to 2026-07-18 |

### Commands and results

- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npx vitest run src/shared/lib/app-style-recovery.test.ts src/features/orders/components/print-portal.test.tsx`: PASS, 6 tests.
- `npm run build`: PASS with Next.js 16.2.6 after allowing build-time font download.
- Chromium targeted E2E: PASS, 3 tests.
- WebKit targeted E2E: PASS, 3 tests.
- `npm run test`: CONDITIONAL, 221 files passed and one unrelated store repository file had five date-sensitive failures.
- `git diff --check`: PASS.

### Visual evidence

- `screenshots/TASK-20260718-011-global-style-recovery/mobile-login-styled.jpg` — production build at 390x844.
- `screenshots/TASK-20260718-011-global-style-recovery/desktop-login-styled.jpg` — production build at 1440x900, no horizontal overflow.

### Documentation sync

- User-facing operation and API contracts are unchanged, so no public manual/API document update is required.
- Recovery behavior, trigger events, test matrix and rollback are documented in this task archive and executable tests.
- The existing UI declarations remain authoritative; no design-system token or page-generation rule changed.

### Capability review

- Evidence supports a C1 candidate for root-layout stylesheet failure diagnosis and cross-engine verification.
- No capability, permission or autonomy upgrade was made from a single task.
