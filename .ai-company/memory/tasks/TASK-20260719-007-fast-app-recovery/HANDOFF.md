# Handoff — TASK-20260719-007-fast-app-recovery

## Resume state

- Candidate branch: `codex/app-style-recovery-fast-20260719`.
- Baseline: `origin/main@25752bd1`.
- Quality state: final source locally verified, including real SW v4 Chromium/WebKit; Owner has authorized production release; preflight database gate is a confirmed no-op.

## Read first

1. `TASK.md`, latest `CHECKPOINTS.md`, and `EVIDENCE.md` in this directory.
2. `src/shared/lib/app-style-recovery.ts`.
3. `src/app/layout.tsx`, `src/styles.css`, and `src/components/app-style-recovery.tsx`.
4. `tests/e2e/app-style-recovery.spec.ts` and `public/sw.js`.

## Next exact release action

1. Obtain final read-only ARCH/QA conclusion for the standalone fallback diff.
2. Commit the exact scoped source, tests, screenshots and task memory; do not broad-stage generated test artifacts.
3. Immediately before push, fetch and require the recorded `origin/main` to remain an ancestor with no overlapping recovery drift.
4. Push exact candidate HEAD to `main` without force.
5. Run the formal linked database command; because dry-run is up to date, it must execute no migration.
6. Verify the exact production deployment, normal mobile/desktop loading, registered Service Worker v4 path, fallback asset/probe, and recovery behavior; then append closeout evidence.

## Stop conditions

- Reload loop, false-ready shell, affected login/session/IndexedDB/outbox state, unexpected Service Worker cache scope, overlapping main drift or any request to clear business data.
