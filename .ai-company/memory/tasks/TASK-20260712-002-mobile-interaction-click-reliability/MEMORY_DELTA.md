# Memory Delta — TASK-20260712-002-mobile-interaction-click-reliability

## Candidate updates

- **Verified frontend rule:** when a `DropdownMenu` is nested inside a mobile `Sheet`/`Dialog` and its action navigates, unmounts, or closes the outer layer in the same transition, the outer layer owns modality and the inner menu uses `modal={false}`. Verify that `document.body.style.pointerEvents` is released after the transition.
- **Verified semantic rule:** informational progress/count chips must not use button semantics without a real action.
- **Verified authority rule:** initial `stores/context` permission hydration must not key-remount the interactive shell; establish the first stable fingerprint without changing the boundary key, then preserve remount/reset behavior for later real authority changes.
- **Verified QA rule:** mobile interaction regression must use touch input, center-point hit-testing, 390/430 widths, pointer-lock assertions, and at least one modal handoff. `npm run test:e2e:interactions:mock` is the local and manual GitHub Actions workflow command.
- **Observed QA risk:** the default parallel full Vitest run can exceed existing 5s per-test limits in Radix/user-event suites on a resource-constrained host. Confirm timeout-only failures in isolation and with a complete single-worker run before classifying them as code regressions.
- **Not promoted:** specific route candidate lists and transient sandbox errors remain task evidence, not product rules. No capability or autonomy promotion is justified by one successful task.

## Memory Change Set

- Updated `departments/frontend.md` with the verified nested-modality, authority-bootstrap and control-semantics contract.
- Updated `departments/qa.md` with the CI mobile-interaction gate and timeout-classification rule.
- Updated component/architecture and Realtime/preload documentation with the same source-backed rules and command.
- No conflict with existing project/department memory; no item superseded.
