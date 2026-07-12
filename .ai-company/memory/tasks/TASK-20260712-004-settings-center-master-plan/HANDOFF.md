# Handoff

Read `TASK.md`, `CHECKPOINTS.md`, and the approved Settings Center plan before continuing.

Current work is isolated on `codex/settings-center-v2-20260712`. Preserve the original dirty checkout. WP-00, WP-01, and WP-02 are implemented and validated on their latest snapshots. WP-02 has independent security and UI/navigation PASS conclusions with no P0/P1 blocker. Create the scoped local WP-02 commit without pushing, then rehydrate the approved WP-03 child-function scope.

WP-02 now uses strict section requests, actor-bound store context, `updated_at` CAS, section-only writes, three-way conflict rebase, multiple-section resolution, and a shared global navigation guard. Browser hard reload supports only native `beforeunload`; do not promise a custom three-choice dialog there. Do not restore the old permissive full-row `{ input }` request.

Read the WP-02 ADR and latest checkpoint before WP-03. Preserve these residual risks: settings/audit are not transactional, Realtime is best-effort, missing-row reads still initialize defaults, and the conflict card has no field-by-field server/local diff. The first WP-03 candidate already recorded by WP-00 is a unified “前往店铺资料” recovery action for blocked customer output; verify the approved plan before expanding beyond that slice.

Do not push, deploy, apply migrations, change role semantics, or correct historical production rows without Owner approval.
