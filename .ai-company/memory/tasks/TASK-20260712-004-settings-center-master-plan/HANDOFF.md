# Handoff

Read `TASK.md`, `CHECKPOINTS.md`, and the approved Settings Center plan before continuing.

Current work has resumed on `codex/settings-center-v2-20260712`. Preserve the original dirty checkout. WP-00, WP-01, WP-02, WP03-A, and WP03-B are committed locally as `6851117c`, `c62223b0`, `19895c2d`, `9e9916ba`, and `e2ef6ce6`; do not push them.

WP-02 now uses strict section requests, actor-bound store context, `updated_at` CAS, section-only writes, three-way conflict rebase, multiple-section resolution, and a shared global navigation guard. Browser hard reload supports only native `beforeunload`; do not promise a custom three-choice dialog there. Do not restore the old permissive full-row `{ input }` request.

Read the WP-02 ADR, the WP03 context packet, and `ADR-WP03-OUTPUT-IDENTITY-RECOVERY.md` before continuing. Preserve these residual risks: settings/audit are not transactional, Realtime is best-effort, missing-row reads still initialize defaults, and the conflict card has no field-by-field server/local diff.

WP03-A is complete and committed locally. It adds semantic recovery metadata without weakening `canOutput`, a shared permission-aware recovery component, four dialog integrations, a deterministic “重新检查资料” loop, and an order-list mobile header measurement fix discovered when the first card could not be clicked. Security and UI reviews both PASS with P0=0/P1=0.

WP03-C notifications/print/default-rules is implemented, validated, and independently reviewed with P0=0/P1=0. Notification previews use saved state plus only the notifications draft; restore defaults changes only the rules draft and still requires CAS save. Inventory intake snapshots the current tenant default, with omitted/zero/positive semantics preserved through API, repository, mock, UI, and receipt tests. Create one scoped local commit before beginning WP-04.

For WP-04, first audit the existing members, invitations, join requests, roles, and supplier-grant flows against the already-adopted server permission model. Do not reinterpret role semantics or add database authority under the Settings task; those are Owner approval gates. Keep API/query/mutation ownership in `SettingsScreen` or existing feature owners and extract only bounded presentation when safe.

Do not push, deploy, apply migrations, change role semantics, or correct historical production rows without Owner approval.
