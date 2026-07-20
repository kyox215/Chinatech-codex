# Acceptance Matrix — TASK-20260720-003

| Requirement | Result | Evidence |
| --- | --- | --- |
| Standard and batch tickets contain exactly one opaque smart QR per order | PASS | E-008, E-009 |
| Print waits for all links; failure and repeated clicks cannot start overlapping or partial print | PASS | E-008, E-009 |
| Public page exposes only the approved customer-status projection | PASS | E-008, E-009, E-018 |
| Invalid, expired, revoked, voided or inactive-store links fail uniformly | PASS | E-008, E-009 |
| Public route is outside AppShell/login redirect and has no-store/noindex/security headers | PASS | E-009, E-018 |
| Staff resolution requires login, same-store actor and order permission | PASS | E-008, E-018 |
| UUID schema, RLS, grants, atomic issue/revoke/audit and one-active invariant | PASS | E-007, E-013, E-014 |
| Migration history and exact dry-run gate | PASS | E-004–E-006, E-014 |
| Lint, typecheck, full tests and production build | PASS | E-008 |
| Chromium, WebKit and PDF pagination | PASS | E-009 |
| Exact main commit, READY production deployment and smoke | PASS | E-015–E-018 |
| Physical Safari + HP paper output + phone scan | OWNER DEVICE CHECK | E-011 |
| Browser stress at batch size 50 | P2 FOLLOW-UP | QA/UX final review |

Conclusion: software, data, security and production release gates pass. The task is closed with one device-specific owner acceptance check and one non-blocking P2 browser stress case.
