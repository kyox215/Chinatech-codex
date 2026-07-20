# Execution Plan — TASK-20260720-002

## Change contract

- Allowed: print CSS/components/hooks, order task/list/detail print wiring, dashboard/new-order/navigation guard/shell actions, focused tests/E2E, CI script/workflow only if required by the new gate, task docs/screenshots.
- Forbidden: migrations, dependency changes, unrelated formatting/refactors, production data, secrets, force push.
- Single writer: Integration Lead in the isolated worktree.

## Work packages

### WP-00 Baseline and contracts

- Verify latest origin, dirty-worktree isolation, task memory, agent packages and narrow baseline tests.
- Exit: clean isolated worktree at recorded SHA and implementation package agreed.

### WP-01 Print isolation and lifecycle

- Fix cascade-layer isolation, add explicit print exclusions, remove silent clipping, centralize prepare/print/cleanup.
- Exit: print media computed styles correct in Chromium/WebKit; focused tests pass.

### WP-02 Print entry correctness

- Task page uses formal ticket; customer tickets remove internal QR/link; list printing uses explicit lifecycle.
- Exit: detail/list/task/inventory print contracts covered.

### WP-03 Intake reliability

- Fix closing-overlay/pointer-lock race, guarded outcome/error behavior, shared start-new-order/session semantics and parameter re-prefill.
- Exit: focused unit tests and repeated-entry E2E pass.

### WP-04 Independent review and full gates

- Architecture/UI/security/QA review, React review, lint/typecheck/full test/build, Chromium/WebKit E2E, screenshots/PDF.
- Exit: no BLOCKER/MAJOR open and scoped diff clean.

### WP-05 Release and observation

- Re-fetch remote, commit scoped files, push `main`, wait exact Vercel SHA to READY, smoke aliases/deployment URL, inspect build/runtime errors, retain rollback SHA.
- Exit: production evidence complete; otherwise rollback or remain observing.

## Architecture decision

- Preferred: extend existing PrintPortal and NavigationGuard contracts without new dependency or route stack.
- Alternative rejected for this release: dedicated PDF service/iframe print route. It has stronger isolation but adds operational surface and does not address the immediate overlay/entry defects.
- Review trigger: if browser print remains inconsistent after real-device validation, create a separate PDF-first ADR.

## Rollback

- Keep print and intake changes logically separable in the commit diff.
- Before push record previous remote SHA; rollback by reverting the release commit and waiting for the revert deployment, never force-reset shared `main`.
- No database rollback is required.
