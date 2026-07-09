---
schema_version: 1
current_task_id: "TASK-20260709-021-independent-store-project-declaration"
status: "verified"
phase: "release_pending"
task_class: "documentation"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead"
last_checkpoint_at: "2026-07-09T21:09:17Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

Write the independent-store platform relationship rule into the project declaration.

## Current state

- Status: verified, release pending.
- Canonical docs updated in `/private/tmp/repairdesk-project-declaration`.
- No code, UI, migration, Supabase, or production data changes are included in this slice.
- Validation passed: `git diff --check`, `npm run agents:config`, `npm run agents:templates`, and `npm run agents:check`.

## Next action

Commit and push the scoped documentation change to `main`.
