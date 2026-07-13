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

WP-05 Kiosk/customer-iPad is locally implemented, committed as `f311b06a`, and extended by the unpushed WP05-B hardening slice. It now has owner/manager review enforcement, end-to-end dual-flag fail-closed behavior for every production or Supabase-backed non-E2E runtime, reduced public/staff DTOs, pairing/submit CAS, viewed-version accept/return CAS, store-bound mock parity, stable no-store public errors, Kiosk realtime groups, transient network form retention, revoked-token PII clearing, raw-signature pruning after review, and store/session/version-bound return-reason drafts guarded across navigation.

Final WP05-B evidence: 160 files / 1034 Vitest tests; independent DATA, SECURITY, and QA terminal reviews report P0=0/P1=0; Kiosk six-width responsive coverage plus the existing final review/return/revoke Playwright flow; agents check, full lint, typecheck, diff check, and the latest production build pass. The three unchanged WP-05 visual screenshots are:

- `screenshots/responsive-density/settings/wp05-kiosk-review-return-390x844.png`
- `screenshots/responsive-density/settings/wp05-kiosk-public-returned-390x844.png`
- `screenshots/responsive-density/settings/wp05-kiosk-device-revoke-1280x800.png`

The latest production build passed outside the sandbox. The sandbox-only Turbopack port-bind failure remains an environment limitation, not a code result.

Do not describe WP-05/WP05-B as production-ready. Both Kiosk flags must remain disabled in every Supabase-backed environment. The staged migration has no executable PostgreSQL reset/apply evidence because local Docker is unavailable. Production still requires Gate 2A, Owner-approved linked preflight/apply/post-check, transactional review RPC/outbox and Storage compensation, distributed rate limiting and pairing-failure audit, token rotation, role semantics, signature/PII retention and GDPR copy, and failure-recovery proof.

WP-06 order workflow is locally implemented and ready for a scoped local commit. Editing status fields, ordering, defaults, and transitions now changes only a cloned store-bound draft. The UI presents change impact and validation, guards dirty navigation, and keeps Apply locked instead of calling the four non-transactional legacy endpoints. Custom targets fail closed across create, manual/configured, and mock notification paths; unknown codes no longer map to `closed`.

Final WP-06 evidence: independent architecture, data/security, and UX/QA reviews at P0=0/P1=0; 7 focused files / 98 tests; 162 full files / 1052 tests; six responsive Playwright cases; agents check, lint, typecheck, diff check, and final production build pass. Four synthetic screenshots cover mobile, Sheet, review, and desktop states.

Do not describe WP-06 Apply as available or production-ready. The legacy endpoints remain non-transactional and revision-free. Production needs a store-scoped historical custom-status audit, revision/CAS, a single transactional RPC, active-order compatibility checks, atomic audit/outbox, and a separately approved data-repair plan if old rows are already misclassified.

WP-07 order data is now locally conditionally closed and ready for one scoped local commit. It uses exact-`1` default-off flags, active-primary-owner/store checks, indexed but order-preserving maximum-contract matching, a pre-workbook repair-item cap, store-scoped sanitized batch history, complete formula-safe reports, expiry and duplicate protection, final confirmation, partial recovery, dirty navigation, and 44px mobile controls.

Final WP-07 evidence: architecture/security/UI reviews P0=0/P1=0; 9 focused files / 104 tests; full 167 files / 1073 tests; dedicated Playwright 10/10 across six widths; broader Settings run passed; lint, typecheck, Agent rules, diff check, and production build pass. Five synthetic screenshots cover default mobile/desktop, preview, confirmation, and partial recovery.

Do not enable real export/preview until reliable PII cleanup scheduling/monitoring, a streaming request-body hard limit, rate/concurrency governance, abandoned-batch cleanup, and capacity proof exist. Apply additionally requires atomic staging, normal-create workflow/default-warranty/audit parity, measured safe transaction sizing, runtime result validation, complete impact/recovery evidence, and separately approved migration/linked verification.

The next safe package is WP-08 whole-plan quality, operator/release documentation, evidence reconciliation, and approval-ready rollback packaging. Do not push, deploy, apply migrations, enable Kiosk or order-data flags, change role/retention semantics, unlock workflow/order-data Apply, or inspect/correct production rows without Owner approval.

WP-08 local packaging is now complete. Read `WP08_ACCEPTANCE_MATRIX.md`,
`WP08_RELEASE_READINESS_PACKET.md`, `WP08_CLOSEOUT_REPORT.md`, `WP08_VISUAL_EVIDENCE.md`, and
`docs/SETTINGS_CENTER_OPERATOR_GUIDE.md` before continuing. Final local gates pass: 167 files / 1073
Vitest tests, exact interaction E2E 54 passed / 1 existing conditional skip, agents, lint, typecheck, and
22-page build. Four clean WP08 screenshots cover mobile/desktop overview, desktop member Drawer, and
mobile store recovery.

Do not mark the master task closed. After its WP08 package the branch is 12 ahead / 8 behind
`origin/main` and has 24 overlapping paths. The next recommended action is an Owner-authorized clean
latest-main integration and PR-preparation scope with split release units. Linked preflight/dry-run/apply,
real flags, production data, push, deployment, retention/role decisions, and customer communication each
remain separate approval gates.
