---
task_id: "TASK-20260712-004-settings-center-master-plan"
status: "in_progress"
phase: "wp03c_notifications_rules"
risk_level: "R3"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
integration_lead: "RepairDesk Integration Lead"
baseline: "a76852f61b09f1b84ccf0def957312026d6eb3b3"
branch: "codex/settings-center-v2-20260712"
worktree: "/private/tmp/repairdesk-settings-center-20260712"
updated_at: "2026-07-12T14:54:32Z"
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

- WP-00, WP-01, and WP-02 are implemented, validated, independently reviewed, and committed locally as `6851117c`, `c62223b0`, and `19895c2d`.
- WP-03 scope is rehydrated in `WP03_CONTEXT_PACKET.md`. WP03-A is committed locally as `9e9916ba`.
- WP03-A keeps output fail-closed while adding semantic recovery metadata, a shared responsive recovery component, four dialog integrations, deterministic recheck after cross-tab repair, and a mobile first-card reachability fix discovered by browser testing.
- WP03-B account/store extraction is implemented and fully reviewed with P0=0/P1=0. Its scoped local-only commit is the next action; WP03-C notifications/rules follows.
- No production database, push, or deployment action has been performed.

## Acceptance gates

- Five-role permission behavior is capability-driven and server-enforced.
- Store A state, secrets, drafts, and output identity never appear in Store B.
- `/settings` defaults to the searchable overview and preserves all nine valid query deep links.
- Six viewport matrix has no page-level horizontal overflow.
- Required repo gates pass before task closeout.
