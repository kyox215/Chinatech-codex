# WP-09 Latest-Main Integration Report

Status: **CONDITIONAL LOCAL PASS — evidence commit `e7102868`; push/PR and production remain NO-GO**
Prepared: 2026-07-14 CEST
Decision owner / sole writer: RepairDesk Integration Lead
Target: `origin/main@d5384e88ca1e974d0aa58156728eb29092a7d7ff`
Source: `codex/settings-center-v2-20260712@d1b4dcaf0af34a881bf877efa3e45934a1bb7b73`
Integrated branch: `codex/settings-center-v2-integrated-20260714`
Refreshed pre-evidence HEAD: `4584ca793fc27551e8d0eaad159b8e2a87c589da`
Local evidence commit: `e7102868a310c92a31fda2901e8d65ea1ff929d1`

## Outcome so far

- Created a new clean worktree from freshly fetched `origin/main`; the original dirty checkout and source
  Settings worktree remain untouched.
- Replayed all twelve Settings commits in their original order. When `origin/main` advanced from `54c29e29`
  to `70d211b2` during evidence preparation, stashed the uncommitted WP09 evidence and rebased the same
  ordered commits onto the refreshed target. When main then advanced to the documentation-only closeout
  `d5384e88`, repeated the protected stash/rebase flow and retained both buyback and Settings memory facts.
- Corrected the overlap record from 24 to 32 exact paths: 23 product/code plus nine memory.
- Resolved the initial 16 conflict paths semantically. The `70d211b2` refresh required five conflict files and
  one buyback E2E stash resolution. The final `d5384e88` documentation sync required ten rebase conflict
  files and two stash conflict files; all were memory-only and were unioned without erasing either task.
  Current-main sensitive-buyback
  feature-off, active/archive order handling, grouped search, mobile header cleanup, inventory CAS and memory
  history remain alongside Settings tenant output, capabilities, drafts, default warranty, Kiosk, workflow,
  and order-data contracts.
- The earlier tenant/legal P1 is now contained by refreshed main: sensitive evidence, signature, payment,
  finalize and legacy import are hard-coded off in the UI and rejected by Router/repository boundaries. Quote,
  evaluation and non-sensitive record save remain available. Re-enablement is still a separate R4 release.
- No unresolved conflict markers or unmerged paths remain. Working-tree and staged diff checks pass.
- No database command, production read/write, real flag change, push, PR, deployment, destructive cleanup,
  secret access, customer communication, or external release occurred.
- Replaced the desktop order-row action's client-scheduled route transition with a native direct-detail
  link. This keeps the menu reliable under a loaded development server and preserves row-dialog isolation.
- Stabilized the first hydrated render of new-order identity and inventory query output so server and client
  do not replace those controls during startup; the browser hydration warnings are gone.
- Split the eight-route desktop overflow loop into independent cases, made animated overlay bounds wait for
  their settled position, and made inventory action selection tolerate the short primary-action rerender
  after a nested dialog closes. Assertions and covered workflows were retained.

## Commit provenance

| Source | Integrated | Subject |
| --- | --- | --- |
| `6851117c` | `cec63350` | enforce tenant-safe capabilities and output |
| `c62223b0` | `8b4d9f42` | responsive Settings overview |
| `19895c2d` | `ef6e00b9` | conflict-safe section drafts |
| `9e9916ba` | `a7860079` | customer-output recovery |
| `e2ef6ce6` | `446bd87b` | account and store workspace |
| `2049f2b2` | `3f4d6170` | notifications and default rules |
| `6ff4c2cb` | `a5db5d18` | member access and suppliers |
| `f311b06a` | `199783b6` | customer Kiosk workflows |
| `deba58f7` | `084655c9` | Kiosk data boundaries |
| `2ef412d0` | `3b45d542` | safe workflow drafts |
| `04273546` | `4d13afe3` | order data center |
| `d1b4dcaf` | `4584ca79` | WP08 local readiness |

## Verification evidence

| Gate | Result |
| --- | --- |
| source representation / 32-path intersection | PASS — all 12 commits rebased; 32 exact common paths |
| conflict-marker / unmerged-path scan | PASS — zero unmerged paths or markers |
| working-tree and staged `git diff --check` | PASS |
| `npm run agents:check` | PASS |
| `npm run lint` | PASS after one Prettier-only assertion wrap |
| `npm run typecheck` | PASS |
| controlled full Vitest | PASS — 179 files / 1179 tests with `--maxWorkers=2` |
| default-concurrency Vitest classification | 176 files passed; three timeout files then passed 30/30 in isolation; no functional failure retained |
| `npm run build` | PASS — 22/22 pages outside sandbox; sandbox-only Turbopack port bind is environmental |
| focused feature-off + overlap suites | PASS — 11 files / 142 tests |
| `npm run test:e2e:interactions:mock` | PASS — 64 passed / one existing conditional skip on code-identical `70d211b2` tree |
| `npm run test:e2e:settings:mock` | PASS — 67/67 on code-identical `70d211b2` tree |
| desktop page/dialog/order matrix | PASS — 44/44 on the `d5384e88` worktree |
| guided buyback quote-only + dashboard quick-start | PASS — 13/13 on the `d5384e88` worktree |
| integrated visual inspection | PASS — six synthetic images inspected; two buyback images regenerated on final worktree |

On the initial `54c29e29` base, the full desktop run exposed two timing-sensitive failures after 42 successful
cases: a client-scheduled order menu transition and an inventory primary-action rerender window. Both causes
were fixed, the unit regression requires a native detail `href`, and the final latest-main desktop command now
passes 44/44 in one run. The first default-concurrency Vitest command also exposed three host-load timeouts;
all three files passed 30/30 in isolation and the controlled complete run passed 179/179 files and 1179/1179
tests. Any containing-commit failure reopens this report.

## Independent read-only reviews

- `/root/settings_integration_architecture`: all 272 source patch paths were represented on the initial base
  and the conflict unions were structurally correct. The review found the guided-buyback tenant/legal P1
  that the refreshed main commit now contains through hard-coded feature-off.
- `/root/settings_integration_security`: local integration is conditional pass; focused 277 tests pass;
  production is NO-GO; exact flag, migration, PII, transaction and guided-buyback invariants were retained.
- `/root/settings_integration_qa`: final local result depends on full lint/Vitest/build, interactions,
  Settings/order-data, desktop and guided-buyback browser suites plus integrated screenshots.

All reviewers were read-only. The main thread remained the sole writer and integrator. Reviewers did not
stage, commit, push, deploy, run database mutations, handle secrets, or contact external parties.

## Sensitive-buyback containment inherited from refreshed main

Runtime commit `70d211b2`, retained by target `origin/main@d5384e88`, implements the immediate fail-closed
response to the architecture finding:

- `BUYBACK_SENSITIVE_WORKFLOW_ENABLED` is a hard-coded `false`, not a client or request flag.
- The workspace exposes four steps only: device, quote, inspection and non-sensitive record save. Seller
  identity, document files, payment, signature, legal agreement and finalize controls are absent.
- Router boundaries reject restricted attachment upload, buyback finalize and legacy electronics import.
- Repository boundaries independently reject restricted attachment/finalize/import writes, so a bypassed UI
  still fails closed. Stored allowlisted legacy markers are preserved while new client-supplied markers and
  customer metadata are stripped from quote-only writes.
- Owner, Manager and Sales share the same quote-only flow; the E2E contract asserts zero upload/finalize
  requests at mobile and desktop widths.

This contains the immediate P1 for this candidate; it is not legal-document tenantization and does not make
the sensitive workflow production-ready. Re-enablement requires a separately reviewed R4 release covering
approved tenant legal identity/versioned documents, migration/RPC, private storage, authorization, retention,
cleanup, monitoring and Owner approval. Mutable Settings display identity must not become signed legal text.

## Visual evidence

- `screenshots/responsive-density/settings/wp09-integration-overview-390x844.png`
- `screenshots/responsive-density/settings/wp09-integration-overview-1440x900.png`
- `screenshots/responsive-density/settings/wp09-integration-member-drawer-1280x800.png`
- `screenshots/responsive-density/settings/wp09-integration-store-recovery-390x844.png`
- `screenshots/responsive-density/settings/wp09-integration-buyback-closed-390x844.png`
- `screenshots/responsive-density/settings/wp09-integration-buyback-closed-1440x900.png`

The four Settings images were inspected on the integrated candidate and remained byte-identical through the
documentation-only final main sync. The two buyback files were regenerated and inspected on the final
four-step closed-state worktree. All are synthetic and free of the Next development indicator.

## Production boundary

The integrated chronological migration order is:

1. `20260710150000_order_data_roundtrip.sql`
2. `20260712002317_global_staff_permission_grants.sql`
3. `20260712003452_global_order_assignment_scope.sql`
4. `20260712150000_buyback_guided_evidence_finalize.sql`
5. `20260713144316_kiosk_integrity_expand.sql`

Do not use generic or `--include-all` database push. No database action is authorized. Kiosk production
and review flags plus order-data export/Apply flags remain `0`; workflow Apply and member production units
remain excluded. Full release-unit, transaction, retention, capacity, observability, target, rollback-owner,
and Owner gates remain open.

## Next action

Stop at the Owner gate. Push or PR creation requires a new explicit instruction. No merge, database command,
flag change, deploy, production access or other external state change is authorized.
