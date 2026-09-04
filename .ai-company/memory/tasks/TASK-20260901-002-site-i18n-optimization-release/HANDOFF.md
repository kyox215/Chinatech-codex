# Handoff / Resume — TASK-20260901-002-site-i18n-optimization-release

## Resume packet — 2026-09-04 corrective release integration

- **Status:** release commit `a274f756b46b017e9560e948cc3fcd51cc78d2d8` is on `origin/main` and production READY; a bounded test-only corrective commit is pending because its hosted E2E run exposed a stale localized print-button locator.
- **Workspace/branch:** canonical root `/Users/kyox215/Documents/文稿 - kyox215的MacBook Pro/Codex/2026-05-17/zip-github`, branch `main`, current `HEAD = origin/main = a274f756b46b017e9560e948cc3fcd51cc78d2d8` before the corrective commit.
- **Uncommitted candidate:** one E2E spec plus this task's contract/checkpoint/evidence/handoff files. `next-env.d.ts` and four automatically overwritten historical screenshots were restored. Unrelated health-audit memory and bulk generated screenshots remain unstaged.
- **Verified baseline:** Node 22 lint/typecheck PASS; Vitest 520 files / 4,490 tests PASS; build 30/30 PASS; independent staged-scope QA P0/P1 zero.
- **Failure/root cause:** the first final Chromium run passed 139 non-Scanner tests, then the old Scanner spec searched only for Chinese `拍照` after Order Detail became localized. The tri-locale locator correction passed the exact Italian reproduction and the full Chromium Scanner suite 22/22.
- **Final browser evidence:** Chromium language-switcher plus Scanner/Camera 31/31 PASS. One bounded WebKit run was 29/31 PASS, with Scanner/Camera 22/22 PASS. The screenshot/hydration failure was repaired and passed its single related re-verification; the keyboard language-menu activation failure remained red.
- **Owner delta:** gate manual Scanner/Camera screenshots behind an explicit environment flag; configure one-worker/serial/failure-only screenshot/video-off/first-retry trace defaults; normal E2E Chromium only; one bounded WebKit final compatibility check.
- **Release authority:** normal `main` push and existing production deployment are authorized only after the updated contract passes. Force push, remote SQL, migration and production-data mutation remain prohibited.
- **Compatibility result:** React event-prop readiness wait closed the pre-hydration race; exact WebKit keyboard verification is 1/1 PASS, forming combined Chromium 31/31 and WebKit 31/31 evidence without product behavior changes.
- **Hosted corrective result:** run `33863005589` failed both engines only because the mobile print test still queried `打印工单`; the product now correctly exposes `打印`, `Stampa` or `Print`. The exact 390/430 flows pass Chromium 2/2 and WebKit 2/2 locally with one worker and zero retries after the shared anchored tri-locale locator correction.
- **First action:** stage only the one spec and four task-memory files, create and normally push the corrective commit, then require new exact-SHA hosted CI/E2E, Vercel READY, canonical-domain smoke and closeout evidence.
