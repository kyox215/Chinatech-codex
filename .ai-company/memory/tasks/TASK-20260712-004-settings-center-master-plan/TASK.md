---
task_id: TASK-20260712-004-settings-center-master-plan
status: in_progress
phase: wp03_scope_rehydration
risk_level: R3
autonomy_level: L2
owner: CEO-Orchestrator
integration_lead: RepairDesk Integration Lead
baseline: a76852f61b09f1b84ccf0def957312026d6eb3b3
branch: codex/settings-center-v2-20260712
worktree: /private/tmp/repairdesk-settings-center-20260712
updated_at: 2026-07-12T12:14:05Z
---

# Settings Center v2

## Objective

Complete the approved WP-00 through WP-08 Settings Center plan using local, reversible changes. Stop for Owner approval before production data changes, role-semantics changes, data-retention changes, pushing `main`, or deployment.

## Approved scope

- WP-00: tenant-bound transient secrets, server-computed capabilities, tenant-neutral customer output.
- WP-01: settings overview, section registry, mobile/desktop responsive shell.
- WP-02: section-scoped drafts, save states, dirty guard, version/conflict contract.
- WP-03 through WP-07: complete the nine existing setting domains without expanding production authority.
- WP-08: full quality gate, screenshots, documentation, release/rollback package.

## Current status

- WP-00, WP-01, and WP-02 are implemented, validated on their latest snapshots, and independently reviewed with no remaining P0/P1 blocker.
- WP-02 is ready for its scoped local commit. WP-03 scope rehydration is the next phase; its first recorded slice is the unified store-profile recovery action for blocked customer output.
- No production database, push, or deployment action has been performed.

## Acceptance gates

- Five-role permission behavior is capability-driven and server-enforced.
- Store A state, secrets, drafts, and output identity never appear in Store B.
- `/settings` defaults to the searchable overview and preserves all nine valid query deep links.
- Six viewport matrix has no page-level horizontal overflow.
- Required repo gates pass before task closeout.
