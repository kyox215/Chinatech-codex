# Memory Delta — TASK-20260723-007-all-print-functions-audit

## Candidate project facts

- Task-local audit only; no project or department long-term memory update is applied before the owner decides whether to authorize fixes.
- Stable findings are recorded in `REPORT.md`: buyback receipt lacks a dedicated print document; order task/detail print gates are not fully aligned with list/server permission and QR rules; Safari native preview remains a manual release gate.

## Candidate department updates

- None yet.

## Candidate decisions / ADRs

- None yet.

## Candidate lessons and capability evidence

- Chromium and WebKit can verify print DOM, media isolation and print invocation, but not the macOS Safari native dialog or physical printer result.
- Production PWA Service Worker registration can bypass Playwright page routes in WebKit; controlled print tests must block Service Workers or use a dedicated non-PWA test build.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
