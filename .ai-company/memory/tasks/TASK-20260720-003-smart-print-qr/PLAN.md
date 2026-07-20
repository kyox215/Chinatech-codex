# Plan — TASK-20260720-003

## Phase 1 — Gate and contract

- Rehydrate exact main code, review current Supabase changelog/docs, classify R3/L2.
- Obtain three independent read-only reviews.
- Verify linked migration history and run `db push --dry-run` before production DDL.
- Exit: schema/API/security contract is evidence-backed and migration chain is safe to extend.

## Phase 2 — Data and server boundary

- Generate one additive migration with the project CLI.
- Add hash-only link repository/service and strict public/staff projections.
- Add issue, public resolve and authenticated staff resolve route handlers.
- Exit: local focused tests prove token secrecy, same-store authorization, uniform unavailable behavior and grants/RLS SQL.

## Phase 3 — Public UX and print integration

- Add thin `/r` route plus feature-owned client screen covering loading/success/unavailable/error/staff states.
- Add shell/proxy exemptions narrowly for `/r` and public resolve only.
- Make single and batch print preparation async, bounded and fail-closed; render one QR per ticket without changing half-page paper mode.
- Exit: component/unit tests and browser/PDF evidence prove QR presence, page count and no leaked UI.

## Phase 4 — Full verification and independent review

- Run lint, typecheck, full Vitest and build.
- Run focused Chromium/WebKit, PDF page-count and security tests.
- Ask the three read-only agents to review the actual diff and gate evidence.
- Exit: QA/SEC/Data reviews are PASS or explicitly conditional with no release blocker.

## Phase 5 — Serialized production release

- Re-fetch main; verify exact scoped diff and rollback target.
- Re-run migration history and dry-run, apply only the new migration, then verify table/grants/RLS/FKs.
- Commit and non-force push exact scope to main; wait for exact Vercel SHA READY.
- Run public/auth/canonical/error smoke with an ephemeral synthetic test link if safe, then revoke it.
- Exit: production DB and app match the release commit, rollback is recorded, task memory/checkpoint/documentation are synchronized.

## Rollback

- Database migration is expand-only; application rollback does not require dropping the link table.
- Code rollback uses an explicit revert and Vercel rollback to the previously recorded READY deployment; never force-push.
- If production public behavior fails, remove/disable QR issuance in code, redeploy, and keep existing link rows inert; do not destroy data during incident response.
