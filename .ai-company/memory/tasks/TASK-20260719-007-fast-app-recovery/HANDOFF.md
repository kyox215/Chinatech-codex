# Handoff — TASK-20260719-007-fast-app-recovery

## Resume state

- Candidate branch: `codex/app-style-recovery-fast-20260719`.
- Baseline: `origin/main@25752bd1`.
- Quality state: locally verified; production release not authorized or performed.

## Read first

1. `TASK.md`, latest `CHECKPOINTS.md`, and `EVIDENCE.md` in this directory.
2. `src/shared/lib/app-style-recovery.ts`.
3. `src/app/layout.tsx`, `src/styles.css`, and `src/components/app-style-recovery.tsx`.
4. `tests/e2e/app-style-recovery.spec.ts` and `public/sw.js`.

## Next exact action after Owner release approval

1. `git fetch origin --prune` and compare current `origin/main` with baseline.
2. Stop if any recovery file has overlapping drift; review and re-integrate instead of force applying.
3. Rebase/cherry-pick the scoped candidate onto latest main in a clean worktree.
4. Rerun typecheck, targeted Chromium/WebKit production E2E and build.
5. Push without force, verify Vercel Ready, then reproduce the real mobile offline/foreground recovery path.

## Stop conditions

- Reload loop, false-ready shell, affected login/session state, unexpected Service Worker cache scope, overlapping main drift or any request to clear business data.
