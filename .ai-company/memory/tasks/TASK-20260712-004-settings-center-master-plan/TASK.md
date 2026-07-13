---
task_id: "TASK-20260712-004-settings-center-master-plan"
status: "in_progress"
phase: "wp04_local_conditional_closeout"
risk_level: "R3"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
integration_lead: "RepairDesk Integration Lead"
baseline: "a76852f61b09f1b84ccf0def957312026d6eb3b3"
branch: "codex/settings-center-v2-20260712"
worktree: "/private/tmp/repairdesk-settings-center-20260712"
updated_at: "2026-07-13T02:03:44Z"
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

- WP-00, WP-01, WP-02, WP03-A, and WP03-B are implemented, validated, independently reviewed, and committed locally as `6851117c`, `c62223b0`, `19895c2d`, `9e9916ba`, and `e2ef6ce6`.
- WP03-C notifications/print/default-rules is implemented, fully validated, independently reviewed with P0=0/P1=0, and committed locally as `2049f2b2`.
- Notification previews isolate the saved snapshot plus only the current notifications draft. Default warranty rules use a shared 0/positive/omitted contract, and inventory intake snapshots the current tenant default while later sale never rereads it.
- WP-04 members/access/suppliers is implemented and validated locally. Three independent final reviews report P0=0/P1=0; Settings E2E is 33/33 and full Vitest is 989/989.
- Member role and grant changes are staged, explicit, server-capability driven, store/epoch guarded, and never presented as one atomic write. Inactive-member direct role/grant writes now fail before RPC.
- Supplier editing uses one strict UI/API contract, scoped mock/realtime behavior, mobile/desktop Sheets, quick contact actions, and confirmed archive without a fake restore action.
- WP-04 is only a local conditional close: production member writes remain DB NO-GO until the pending RPC migration, actor/CAS review, transactional integrity, and post-apply verification receive Owner approval.
- No production database, push, or deployment action has been performed.

## Acceptance gates

- Five-role permission behavior is capability-driven and server-enforced.
- Store A state, secrets, drafts, and output identity never appear in Store B.
- `/settings` defaults to the searchable overview and preserves all nine valid query deep links.
- Six viewport matrix has no page-level horizontal overflow.
- Required repo gates pass before task closeout.
