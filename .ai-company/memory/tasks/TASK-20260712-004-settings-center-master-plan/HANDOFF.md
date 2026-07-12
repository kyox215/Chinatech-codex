# Handoff

Read `TASK.md`, `CHECKPOINTS.md`, and the approved Settings Center plan before continuing.

Current work is isolated on `codex/settings-center-v2-20260712`. Preserve the original dirty checkout. WP-00 and WP-01 are implemented, validated on their latest snapshots, and independently reviewed with PASS conclusions. Create the local WP-01 commit, then begin WP-02 with one business-code writer.

WP-02 must preserve `/settings` overview plus all nine query deep links. Its shared dirty guard must cover the desktop rail, overview cards, mobile return, tablet return, AppSidebar/CommandPalette navigation, store switching, and tested back/forward transitions. Browser hard reload supports only native `beforeunload`; do not promise a custom three-choice dialog there.

Do not push, deploy, apply migrations, change role semantics, or correct historical production rows without Owner approval.
