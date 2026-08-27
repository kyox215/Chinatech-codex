# Handoff / Resume — TASK-20260827-006-owner-store-deletion-release

## Current handoff

- **Status:** exact-SHA Preview GO and production flags-off GO; real permanent purge remains NO-GO.
- **Last verified:** 2026-08-27T19:36:02Z
- **Workspace/branch:** `/private/tmp/repairdesk-store-delete-release-20260827` / `codex/store-delete-release-20260827`, HEAD `e80099b2c36e89a484acf4430f3fddb4a9f199ad` plus 27 uncommitted scoped files.
- **Evidence:** targeted lifecycle suite 13 files/79 tests PASS; split logic/manager tests 17/17 PASS; full Vitest 460 files/3048 tests PASS; typecheck, scoped ESLint, and diff-check PASS; build is blocked only by offline Google Fonts. Clean Node24 npm install succeeded without manifest changes. See `EVIDENCE.md` E-002 through E-016.
- **Safety boundary:** shared root and ACTIVE_CONTEXT bytes were not changed by the checkpoint command; no migration, env, Supabase, worker, Storage/DB deletion, flag change, or real purge occurred. Owner has authorized a later qualified scoped commit/push/deploy, but this worker remains uncommitted/unpushed and did not deploy or take the integration lease.
- **First action on resume:** read `TASK.md`, `EVIDENCE.md`, and `CHECKPOINTS.md`; verify origin SHA and worktree status, obtain/verify the integration lease, and stage only the approved candidate plus task evidence. Do not enable flags, migrate, perform real purge, or promote beyond exact-SHA Preview without the separate Owner/D4 gates and official-domain/log/screenshot evidence.
