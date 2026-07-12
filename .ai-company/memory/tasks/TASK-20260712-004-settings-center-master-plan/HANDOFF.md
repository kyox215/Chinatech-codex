# Handoff

Read `TASK.md`, `CHECKPOINTS.md`, and the approved Settings Center plan before continuing.

Current work is isolated on `codex/settings-center-v2-20260712`. Preserve the original dirty checkout. WP-00, WP-01, and WP-02 are implemented, validated, and committed locally as `6851117c`, `c62223b0`, and `19895c2d`; do not push them. WP-03 is active and its approved scope/provenance is rehydrated in `WP03_CONTEXT_PACKET.md`.

WP-02 now uses strict section requests, actor-bound store context, `updated_at` CAS, section-only writes, three-way conflict rebase, multiple-section resolution, and a shared global navigation guard. Browser hard reload supports only native `beforeunload`; do not promise a custom three-choice dialog there. Do not restore the old permissive full-row `{ input }` request.

Read the WP-02 ADR, the WP03 context packet, and `ADR-WP03-OUTPUT-IDENTITY-RECOVERY.md` before continuing. Preserve these residual risks: settings/audit are not transactional, Realtime is best-effort, missing-row reads still initialize defaults, and the conflict card has no field-by-field server/local diff.

WP03-A is complete on its reviewed snapshot and ready for a scoped local-only commit. It adds semantic recovery metadata without weakening `canOutput`, a shared permission-aware recovery component, four dialog integrations, a deterministic “重新检查资料” loop, and an order-list mobile header measurement fix discovered when the first card could not be clicked. Security and UI reviews both PASS with P0=0/P1=0. Full evidence is in `EVIDENCE.md` and the 13:01 checkpoint.

After committing WP03-A without pushing, start WP03-B by extracting account/store UI from `settings-screen.tsx`. Keep queries, mutations, strict section payloads, CAS, active-store scope, dirty guards, and self-service store behavior in the screen/orchestration boundary until a separately reviewed controller extraction exists.

Do not push, deploy, apply migrations, change role semantics, or correct historical production rows without Owner approval.
