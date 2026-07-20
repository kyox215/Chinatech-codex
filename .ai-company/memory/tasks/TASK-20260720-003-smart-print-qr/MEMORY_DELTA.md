# Memory Delta — TASK-20260720-003

Candidate stable rules, pending production closeout:

- Printed customer repair-status QR values use an opaque fragment token; only SHA-256 hashes persist, and public projection remains an explicit privacy allowlist.
- Print is fail-closed: issue all required links before mounting print DOM or invoking `window.print()`; batch issuance is all-or-nothing.
- Link issue/rotation/audit and revoke/audit use service-role-only atomic database RPCs with order locks. A store/order may have only one unrevoked link.
- Store lifecycle revision is captured at issue time, so close/reopen permanently invalidates older paper links.
- Public abuse control uses an atomic global precheck plus trusted-IP/global consumption and a post-resolution token bucket; Vercel IP identity comes only from its platform-normalized header.
- Application rollback keeps the additive schema and disables the feature flag; never drop link history as an app rollback.
