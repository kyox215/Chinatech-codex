# Handoff / Resume — TASK-20260719-004-store-lifecycle-uuid-flow-plan

## Current handoff

- **Status:** released and closed; mutations intentionally disabled.
- **Canonical plan:** `docs/STORE_LIFECYCLE_SETTINGS_FLOW_PLAN.md`.
- **Released artifacts:** PR #1 / main commit `471a2b45`; migration `20260720013000`; Vercel production alias `https://www.chinatech.in`.
- **Current safe state:** DB writer fence and application enforcement are on. Mutation/export/purge flags are off.
- **Next approval point:** use a disposable production store to canary owner MFA, close, recovery context and restore before enabling `STORE_LIFECYCLE_MUTATIONS_ENABLED`.
- **Do not:** run a real operating store close/restore, enable export/purge flags, or execute purge without a new task and explicit Owner approval.
- **Workspace caution:** current checkout contains unrelated dirty work and diverges from origin; preserve it.
