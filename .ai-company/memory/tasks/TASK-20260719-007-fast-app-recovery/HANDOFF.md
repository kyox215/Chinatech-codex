# Handoff — TASK-20260719-007-fast-app-recovery

## Closed state

- Recovery source: `1119ef5d`; code commits `94243401` + `8fa5b172`.
- Production: original exact deployment `dpl_3RmTx8EKHszdMvMpbeNYG57B21H9` is `READY`; later descendant `main@5c67d451` / `dpl_BAKzwYuQisiDChY6MN69wRCB2uVH` retains the same recovery paths and is also `READY` on both canonical domains.
- Database: 91/91 linked migrations paired; post-release dry-run is up to date; no SQL was executed.
- Quality: full repository gates, Chromium/WebKit recovery matrices, registered-SW matrices, production mobile/desktop smoke and runtime observation passed.

## Read first

1. `TASK.md`, latest `CHECKPOINTS.md`, and `EVIDENCE.md` in this directory.
2. `src/shared/lib/app-style-recovery.ts`.
3. `src/app/layout.tsx`, `src/styles.css`, and `src/components/app-style-recovery.tsx`.
4. `tests/e2e/app-style-recovery.spec.ts` and `public/sw.js`.

## Follow-up ownership

1. `OPS-BACKLOG-20260719-002` owns the next real-iPhone natural background/BFCache/network-switch observation.
2. Do not run synthetic business writes, clear device storage or treat this as full offline-first support.
3. Do not modify `ACTIVE_CONTEXT.md` from this closed task; current `main` records a separate closed AI natural-language-query V3 task, while Vision follow-up remains independently scheduled.

## Stop conditions

- Reload loop, false-ready shell, affected login/session/IndexedDB/outbox state, unexpected Service Worker cache scope, overlapping main drift or any request to clear business data.
