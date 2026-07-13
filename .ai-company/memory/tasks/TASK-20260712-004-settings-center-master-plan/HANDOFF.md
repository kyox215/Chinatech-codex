# Handoff

Read `TASK.md`, `CHECKPOINTS.md`, and the approved Settings Center plan before continuing.

Current work has resumed on `codex/settings-center-v2-20260712`. Preserve the original dirty checkout. WP-00, WP-01, WP-02, WP03-A, WP03-B, and WP03-C are committed locally as `6851117c`, `c62223b0`, `19895c2d`, `9e9916ba`, `e2ef6ce6`, and `2049f2b2`; do not push them.

WP-02 now uses strict section requests, actor-bound store context, `updated_at` CAS, section-only writes, three-way conflict rebase, multiple-section resolution, and a shared global navigation guard. Browser hard reload supports only native `beforeunload`; do not promise a custom three-choice dialog there. Do not restore the old permissive full-row `{ input }` request.

Read the WP-02 ADR, the WP03 context packet, and `ADR-WP03-OUTPUT-IDENTITY-RECOVERY.md` before continuing. Preserve these residual risks: settings/audit are not transactional, Realtime is best-effort, missing-row reads still initialize defaults, and the conflict card has no field-by-field server/local diff.

WP03-A is complete and committed locally. It adds semantic recovery metadata without weakening `canOutput`, a shared permission-aware recovery component, four dialog integrations, a deterministic “重新检查资料” loop, and an order-list mobile header measurement fix discovered when the first card could not be clicked. Security and UI reviews both PASS with P0=0/P1=0.

WP03-C notifications/print/default-rules is implemented, validated, independently reviewed with P0=0/P1=0, and committed locally. Notification previews use saved state plus only the notifications draft; restore defaults changes only the rules draft and still requires CAS save. Inventory intake snapshots the current tenant default, with omitted/zero/positive semantics preserved through API, repository, mock, UI, and receipt tests.

WP-04 members/access/suppliers is implemented, locally conditionally closed, and committed as `6ff4c2cb`. It uses service-projected per-member management capabilities, local role/grant drafts, one endpoint per save, store/epoch-gated member mutation reconciliation, inactive-member server rejection, stateful store-scoped mock access requests, supplier-scoped realtime invalidation, and strict supplier validation shared by UI and API. All dangerous actions use pending-locked `AlertDialog` flows with inline failure and focus restoration.

Final WP-04 evidence: three independent reviews P0=0/P1=0; 29 targeted files / 220 tests; full 153 files / 989 tests with one worker; Settings Playwright 33/33 across 390, 430, 768, 1024, 1280, and 1440 widths; agents check, full lint, typecheck, diff check, and production build pass. Build required sandbox escalation only because Turbopack binds an internal local port.

Visual evidence:

- `screenshots/responsive-density/settings/wp04-member-grant-confirm-390x844.png`
- `screenshots/responsive-density/settings/wp04-supplier-card-390x844.png`
- `screenshots/responsive-density/settings/wp04-supplier-created-1280x800.png`

Do not describe WP-04 as production-ready. `20260712002317_global_staff_permission_grants.sql` has no approved production apply proof; the candidate RPC still needs actor membership/role and CAS review, member/access/audit side effects are not transactionally atomic, and active supplier-name uniqueness still needs a separately approved database constraint. These are Owner gates, not local UI follow-ups.

WP-05 Kiosk/customer-iPad is locally implemented and independently reviewed at P0=0/P1=0. It now has owner/manager review enforcement, production fail-closed review writes, production source fail-closed behavior, reduced public/staff DTOs, pairing/submit CAS, store-bound mock parity, stable public errors, Kiosk realtime groups, separate settings-domain loading/errors, pending-locked confirmations, transient network form retention, revoked-token PII clearing, and store/session/version-bound return-reason drafts guarded across navigation.

Final WP-05 evidence: 159 files / 1018 Vitest tests; 14-file independent architecture run / 99 tests; security runs 135 and 42 tests; Kiosk six-width responsive coverage plus the final review/return/revoke Playwright flow; agents check, full lint, typecheck, and diff check pass. The three final screenshots are:

- `screenshots/responsive-density/settings/wp05-kiosk-review-return-390x844.png`
- `screenshots/responsive-density/settings/wp05-kiosk-public-returned-390x844.png`
- `screenshots/responsive-density/settings/wp05-kiosk-device-revoke-1280x800.png`

The latest production build is not a code PASS: Turbopack failed inside the sandbox only because it could not bind an internal helper port, and two outside-sandbox retries were rejected by approval-service capacity. WP-04 at current HEAD had already passed build; WP-05 has current typecheck/full-test proof, but a clean build must be rerun when the approval service is available.

Do not describe WP-05 as production-ready. `REPAIRDESK_KIOSK_REVIEW_WRITES_ENABLED` must remain disabled. Production requires Owner-approved additive same-store/state constraints, transactional review RPC/outbox and Storage compensation, distributed rate limiting and pairing-failure audit, token rotation, role semantics for Kiosk session creation, signature/PII retention and GDPR copy, linked dry-run/apply, and post-apply checks for migration history, RLS, grants, constraints, RPCs, and failure recovery.

Do not push, deploy, apply migrations, change role semantics, or correct historical production rows without Owner approval.
