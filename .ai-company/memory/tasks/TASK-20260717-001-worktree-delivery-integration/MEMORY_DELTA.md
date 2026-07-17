# Memory Delta — TASK-20260717-001-worktree-delivery-integration

## Candidate project facts

- **Fact:** the final integration candidate is intentionally separated from the original dirty checkout; preservation uses a stash, a Git ref and a verified recovery directory. Source: E-002. Status: scoped_verified. Owner: INT. Review trigger: source checkout cleanup.
- **Fact:** `kioskKeys.availableDevices` is a child of the store-scoped device key, so pair/revoke/realtime device invalidation also invalidates order-scoped availability. Source: code and E-004/E-011. Status: scoped_verified. Owner: FRONTEND. Review trigger: query-key changes.
- **Fact:** production release requires unapplied Settings `20260714180000` followed by custody hardening `20260717030000` before application push. Source: E-009/E-010/E-012. Status: locally_verified, production_pending. Owner: DATA/RELEASE. Review trigger: Owner release approval.
- **Fact:** the final candidate removed 997 tracked conflict-copy paths; 974 were byte-identical and 23 were stale snapshots fully superseded by canonical files. Source: E-016/E-017. Status: scoped_verified. Owner: INT/DOC/QA. Review trigger: any new duplicate suffix.
- **Fact:** switching the synchronized Documents checkout from the old custody branch to main produced 25 untracked ` 2` conflict copies containing only complete old/current branch blobs. Source: E-015. Status: inferred_environment_pattern. Owner: INT/OPERATIONS. Review trigger: next branch switch or duplicate recurrence.

## Candidate department updates

- **QA/UX:** customer nested edit/device dialogs disable transform animation locally; 1024/1280/1440 viewport assertions pass without changing global Dialog behavior.
- **SEC/DATA:** custody hardening validates current authorization before idempotent replay, recursively rejects sensitive payload keys and enforces exact terminal update whitelists; PG17 dynamic tests pass 55/55.
- **RELEASE:** generated `next-env.d.ts` and Settings screenshot drift must remain excluded from scoped commits.

## Candidate decisions / ADRs

- Keep Kiosk availability order-scoped and minimal (`id/label/status`), but gate both listing and creation with permission, feature flag and order capability.
- Keep production release DB-first because `main` automatically deploys application code that expects the new migrations.
- Treat Kiosk cross-table TOCTOU as an explicit P2 residual requiring a dedicated transactional RPC design, not an opportunistic patch in this integration task.

## Candidate lessons and capability evidence

- Tailwind state animation utilities with competing transform variables are source-order sensitive; nested fixed dialogs should disable the transform animation locally rather than stack opposite slide utilities.
- A dirty-worktree delivery should be reconstructed on latest main from evidence-backed packages, while the original checkout stays immutable and recoverable.
- Duplicate-file audits must match both ` 2.` and extensionless ` 2`; use a full-path suffix scan such as ` 2(\.|$)`, verify canonical blob equality, then preserve before deletion.
- Do not add `.gitignore` rules for sync conflict copies. Repeated branch-switch recurrence is evidence to move the development clone outside Documents/File Provider synchronization.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
