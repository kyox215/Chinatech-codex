# Checkpoints - Store Identity Hardcode Removal Plan

## 2026-07-17T18:45:36Z - Planning complete

- Completed: read project governance, independent-store plan/progress, store identity code, message/WhatsApp paths, login/sidebar/onboarding hardcoding, buyback legal text, scan payload docs, and historical store settings migrations.
- Completed: created planning task memory with task charter, evidence, phased execution plan, approval points, validation and rollback.
- Not completed: no business code changes, no tests, no production data queries, no database changes, no deploy.
- Key risk: customer-facing links currently derive from browser origin in order/customer pages; partner stores can expose `chinatech.in` until customer output link generation is made store-aware or link output is disabled for unsafe origins.
- Next action: if Owner approves implementation, start WP-01/WP-02 with a fresh scoped code inventory and implement a store-aware public output helper before touching UI copy.
## 2026-07-17T18:47:21Z — Completed planning-only investigation for removing customer-visible Chinatech hardcoding. Added TASK, EVIDENCE, PLAN, and CHECKPOINTS under the task memory directory. No business code, database, deploy, or production data changes.

- **Phase:** planned
- **Completed/current state:** Completed planning-only investigation for removing customer-visible Chinatech hardcoding. Added TASK, EVIDENCE, PLAN, and CHECKPOINTS under the task memory directory. No business code, database, deploy, or production data changes.
- **Next:** If Owner approves implementation, start WP-01/WP-02: fresh hardcode inventory and store-aware customer output identity/link helper before UI copy cleanup.
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator

## 2026-07-17T18:51:53Z - Owner constraint added

- Completed: added explicit hard constraint that the Owner's real ChinaTech shop information must not be written into code defaults, examples, mock/demo data, test fixtures, docs templates, placeholders, platform branding, or seed data.
- Decision: ChinaTech real information is allowed only as ChinaTech tenant data, historical evidence/migration context, or quarantine tests that intentionally prove legacy contamination is blocked.
- Next action: implementation must replace generic examples with neutral fictional values before or alongside customer-output fixes.
## 2026-07-17T18:52:38Z — Owner added hard constraint: do not write the Owner's real ChinaTech shop information into code defaults, examples, mock/demo data, test fixtures, docs templates, placeholders, platform branding, or seed data. Updated TASK, PLAN, CHECKPOINTS and ACTIVE_CONTEXT. No business code, database, deploy, or production data changes.

- **Phase:** planned
- **Completed/current state:** Owner added hard constraint: do not write the Owner's real ChinaTech shop information into code defaults, examples, mock/demo data, test fixtures, docs templates, placeholders, platform branding, or seed data. Updated TASK, PLAN, CHECKPOINTS and ACTIVE_CONTEXT. No business code, database, deploy, or production data changes.
- **Next:** If implementation starts, first replace generic examples/placeholders/mock defaults with neutral fictional values, then implement store-aware customer output identity and links.
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator
## 2026-07-17T19:12:03Z — Implemented store-aware public customer output identity: public_base_url settings field, fail-closed customer/order links, neutral auth/onboarding/sidebar copy, internal print QR path fallback, Chinatech legal buyback profile restriction, and Supabase migration 20260717185048. Validation evidence: lint pass, typecheck pass, full vitest rerun 207 files/1422 tests pass, Next build pass, Supabase migration list aligned, dry-run up to date, db lint no schema errors. Resolved duplicate local migration file after first Supabase push applied the full SQL under a duplicate filename; kept one standard local migration file.

- **Phase:** implementation
- **Completed/current state:** Implemented store-aware public customer output identity: public_base_url settings field, fail-closed customer/order links, neutral auth/onboarding/sidebar copy, internal print QR path fallback, Chinatech legal buyback profile restriction, and Supabase migration 20260717185048. Validation evidence: lint pass, typecheck pass, full vitest rerun 207 files/1422 tests pass, Next build pass, Supabase migration list aligned, dry-run up to date, db lint no schema errors. Resolved duplicate local migration file after first Supabase push applied the full SQL under a duplicate filename; kept one standard local migration file.
- **Next:** Before closing, validate scoped diff, stage only task-owned files, commit and push main. Do not stage unrelated scan/capture/order-screen dirty worktree files. If post-push deployment is checked, verify production customer message/settings flow and avoid production DML unless Owner approves exact preview rows.
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator
## 2026-07-17T19:29:40Z — Post-review fix: removed unrelated rollback function from 20260717185048 migration, added 20260717212000 hardening migration, applied linked Supabase migration, verified remote migration history and strict public_base_url constraint. Validation: targeted tests 7 files/88 tests pass, full vitest 204 files/1417 tests pass, typecheck pass, build pass after sandbox-external rerun, targeted eslint pass; full lint blocked only by unrelated untracked order-edit-save files. Screenshots captured for login/register debranding.

- **Phase:** implementation
- **Completed/current state:** Post-review fix: removed unrelated rollback function from 20260717185048 migration, added 20260717212000 hardening migration, applied linked Supabase migration, verified remote migration history and strict public_base_url constraint. Validation: targeted tests 7 files/88 tests pass, full vitest 204 files/1417 tests pass, typecheck pass, build pass after sandbox-external rerun, targeted eslint pass; full lint blocked only by unrelated untracked order-edit-save files. Screenshots captured for login/register debranding.
- **Next:** Stage only store-identity migration fix and checkpoint files, commit, push main, then report Supabase and validation evidence plus unrelated local dirty-worktree limitations.
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator
