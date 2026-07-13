---
task_id: "TASK-20260712-004-settings-center-master-plan"
status: "in_progress"
phase: "wp07_local_conditional_closeout"
risk_level: "R3"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
integration_lead: "RepairDesk Integration Lead"
baseline: "a76852f61b09f1b84ccf0def957312026d6eb3b3"
branch: "codex/settings-center-v2-20260712"
worktree: "/private/tmp/repairdesk-settings-center-20260712"
updated_at: "2026-07-13T22:40:19Z"
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
- WP-04 members/access/suppliers is implemented, validated, independently reviewed at P0=0/P1=0, and committed locally as `6ff4c2cb`. Settings E2E is 33/33 and full Vitest is 989/989.
- Member role and grant changes are staged, explicit, server-capability driven, store/epoch guarded, and never presented as one atomic write. Inactive-member direct role/grant writes now fail before RPC.
- Supplier editing uses one strict UI/API contract, scoped mock/realtime behavior, mobile/desktop Sheets, quick contact actions, and confirmed archive without a fake restore action.
- WP-04 is only a local conditional close: production member writes remain DB NO-GO until the pending RPC migration, actor/CAS review, transactional integrity, and post-apply verification receive Owner approval.
- WP-05 Kiosk/customer-iPad is implemented, independently reviewed, and committed locally as `f311b06a`. Public DTOs are minimized, pair/submit use compare-and-swap, revoked tokens clear local PII, transient failures retain unsent forms, return-reason drafts are store/session/version bound, and anonymous routes never expose raw internal errors.
- WP05-B Kiosk database/public-entry hardening is locally conditionally closed at P0=0/P1=0. Every production or Supabase-backed non-E2E Kiosk entry requires both default-off flags end to end, so a master-only state cannot collect customer data. Accept/return bind to the viewed submission version, explicit anonymous responses are no-store/same-origin, duplicated PII is reduced, and raw signature data is removed after accept/return.
- The additive `20260713144316_kiosk_integrity_expand.sql` migration is staged but unapplied. It adds three indexes, one same-store device foreign key, eleven state/hash checks (twelve `NOT VALID` constraints total), and bounded DDL timeouts. The executable Gate 2A reset/lint remains unsatisfied because the local Docker daemon is unavailable; linked preflight/apply, constraint validation, and production enabling remain Owner gates.
- Final WP05-B quality evidence is 160 files / 1034 Vitest tests; focused repository/gate/route/migration checks pass; lint, typecheck, agents check, diff check, and the latest production build pass. Turbopack required the approved outside-sandbox build because its sandbox helper cannot bind a port.
- WP-06 order workflow is locally implemented and independently reviewed at P0=0/P1=0. Settings now edits one store-bound in-memory draft, shows a complete review summary, guards dirty navigation, and never calls the four legacy workflow mutation routes while editing.
- Custom/unmapped statuses can no longer fall through to canonical `closed`, cannot be used as real create/transition/notification targets, and foreign-store workflow snapshots are rejected by the local draft boundary.
- Final WP-06 evidence is 162 files / 1052 Vitest tests, 7 focused files / 98 tests, six responsive Playwright cases, full lint/typecheck/agents/diff checks, and a production build. Four final synthetic screenshots cover mobile, Sheet, review, and desktop states.
- WP-06 is only a local conditional close. Apply remains disabled until a store-scoped revision/CAS contract, one transactional RPC, active-order compatibility validation, atomic audit/outbox, and a production historical-data preflight receive separate Owner approval.
- WP-07 order data is locally implemented and independently reviewed at P0=0/P1=0. The Settings flow is store-bound, responsive, progressively renders previews, exports complete formula-safe reports, locks expired/processed batches, protects dirty navigation, and exposes only lazy-loaded sanitized batch summaries.
- Maximum-contract normalization no longer performs a 10,000 × 50,000 scan and preserves repair-sheet row order. Export rejects more than 50,000 repair items before workbook construction. Both high-risk flags now require exact `1`, and real/mock access requires the active primary store owner.
- Final WP-07 evidence is 167 files / 1073 Vitest tests, 9 focused files / 104 tests, dedicated Playwright 10/10 across six widths, broader Settings regression status PASS for 56 cases, full lint/typecheck/agents/diff checks, and a production build. Five synthetic screenshots cover mobile, desktop, preview, final confirmation, and partial recovery.
- WP-07 is only a local conditional close. Production export/preview remains disabled until PII cleanup scheduling/monitoring, a true streaming body limit, rate/concurrency controls, and capacity proof exist. Apply additionally requires atomic staging, normal-create workflow/warranty/audit parity, safe batch sizing, runtime result validation, impact evidence, and separately approved database/release execution.
- No production database, push, or deployment action has been performed.

## Acceptance gates

- Five-role permission behavior is capability-driven and server-enforced.
- Store A state, secrets, drafts, and output identity never appear in Store B.
- `/settings` defaults to the searchable overview and preserves all nine valid query deep links.
- Six viewport matrix has no page-level horizontal overflow.
- Required repo gates pass before task closeout.
