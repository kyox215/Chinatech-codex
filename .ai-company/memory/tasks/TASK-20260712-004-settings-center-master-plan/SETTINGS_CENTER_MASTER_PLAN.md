# Settings Center master plan — current authority

Updated: 2026-07-16

Status: **local integration conditionally complete; production release NO-GO**

This file is the navigation and current-state authority for the Settings Center task. Earlier WP08/WP09
reports remain historical evidence of their own baselines and must not be treated as current production
authorization.

## Current integration state

- Clean integration branch: `codex/settings-center-closeout-20260716`.
- Exact base: `origin/main@6717932e316cbe5054709646ca7ea1087f517a49`.
- Fourteen Settings commits were replayed in order. Every conflict was resolved per file while retaining
  the current Dashboard, Orders mobile queue, Buyback containment and latest project-memory changes.
- The old Settings HEAD and its 21-item dirty overlay are independently recoverable through
  `preserve/settings-center-v2-head-20260716`,
  `preserve/settings-center-v2-dirty-20260716` and the retained named stash.
- No push, PR, deploy, linked database command, production read/write or feature-flag change belongs to
  this local integration.

## Current local validation

- Migration authority tests, focused Settings/Kiosk/store/message/order-data tests and the Kiosk mock/public
  route tests pass.
- `npm run agents:check`, lint, typecheck, `git diff --check` and controlled full Vitest pass; the full result
  is 185 files / 1218 tests.
- `npx next build --webpack` compiled, typechecked and generated 22/22 pages. The repository's default
  Turbopack command is unavailable in this temporary worktree because `node_modules` is an external symlink;
  no code-level build failure is retained.
- Kiosk's synthetic submit/review/return/revoke flow passes twice against one reused server. The E2E owns its
  paired device/token and mock state is shared across separately compiled local API routes.
- Settings/output/Dashboard/Buyback coverage is green by containing-snapshot plus complete affected-suite
  evidence. Dashboard passed 12/12 after extending the asynchronous priority wait from five to 15 seconds.
- Mobile shell/navigation, queue loading and responsive overflow passed 10 cases with one expected conditional
  skip. Current synthetic screenshots were regenerated and representative overview, recovery and Kiosk images
  were visually inspected.

## Work-package status

| Package | Local state | Production state |
|---|---|---|
| WP00–WP03 account/store/notifications/rules | integrated; current gates required | NO-GO until branch release approval |
| WP04 members/suppliers | integrated; local contract only | NO-GO until atomic member-write and authorization gates |
| WP05 Kiosk UI/review | integrated behind default-off dual flags | NO-GO |
| WP05-B Kiosk data hardening | one reviewed migration candidate | NO-GO until Gate 2A, exact linked dry-run and Owner approval |
| WP06 workflow drafts | integrated as draft/review boundary | Apply NO-GO until atomic revision/CAS RPC and audit proof |
| WP07 order-data preview/export/apply | integrated behind default-off flags | preview/export/apply each remain separate NO-GO units |
| WP08 operator/release package | historical package retained | not production authorization |
| WP09 latest-main evidence | historical baseline retained | superseded by this 2026-07-16 integration |

## Migration authority

Recorded applied history, preserved as immutable files and not re-run by this task:

1. `20260710150000_order_data_roundtrip.sql`
2. `20260712002317_global_staff_permission_grants.sql`
3. `20260712003452_global_order_assignment_scope.sql`
4. `20260712150000_buyback_guided_evidence_finalize.sql`
5. `20260714004500_harden_legacy_order_assignment_backfill.sql`

The sole Settings database candidate is
`20260714180000_kiosk_integrity_expand.sql`. It is byte-identical to the earlier never-applied local
Kiosk draft, follows the applied assignment-hardening version, and remains unapplied. The old Kiosk
filename and the obsolete `supabase/pending` Buyback package are excluded. The official applied Buyback
migration remains in `supabase/migrations`; feature activation is still controlled by its separate
default-deny/security release boundary.

Never use `--include-all`, migration repair, history deletion, timestamp reuse or generic linked push to
force this candidate through.

## Current release blockers

1. The security incident has only immediate and minimum-observation evidence; the historical one-hour and
   24-hour windows were not recorded and cannot be recreated retroactively.
2. Default ACL, permissive-policy and other function-hardening residuals need a separate R4 package.
3. Kiosk executable Gate 2A and exact linked dry-run/post-check evidence are incomplete.
4. Member and workflow production writes still lack approved atomic release proof.
5. Order-data privacy cleanup, ingress/capacity/limiting and atomic Apply proof remain open.
6. Push/PR, deployment, database actions and production flags require explicit Owner approval. Passing local
   gates does not lift any production freeze.

## Validation contract

- Migration contract tests for applied Buyback, assignment hardening and the sole Kiosk candidate.
- Focused Settings/Kiosk/store/message/order-data tests.
- `npm run agents:check`, lint, typecheck, full Vitest and production build.
- Settings and interaction Playwright suites plus visual inspection at the maintained responsive sizes.
- `git diff --check`, no unresolved conflict markers, no secret/PII/runbook content and a final memory
  checkpoint before local closeout.

## Rollback and recovery

- Before push: delete/revert only the local integration branch or revert its scoped commits; preservation
  refs and stashes remain untouched.
- After any future push: revert release units independently; do not rewrite applied migration history.
- After any future Kiosk apply: keep flags off and use a separately reviewed forward migration for schema
  rollback. Never delete or rename an applied migration.
