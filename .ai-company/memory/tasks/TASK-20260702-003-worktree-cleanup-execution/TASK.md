---
schema_version: 1
task_id: "TASK-20260702-003-worktree-cleanup-execution"
status: "in_progress"
phase: "execution_started"
task_class: "dirty_worktree_cleanup_execution"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
created_at: "2026-07-02T00:00:00+02:00"
updated_at: "2026-07-02T18:14:11Z"
---
# TASK-20260702-003 Worktree Cleanup Execution

## Owner Goal

Turn the current dirty RepairDesk worktree into executable, reviewable work packages, then start with safe project hygiene actions.

## Business Value

- Prevent accidental blanket staging or accidental release of unrelated work.
- Preserve useful work already done for performance, governance, UI, migrations, and evidence.
- Separate large generated artifacts from source changes before any commit, push, deletion, or production action.

## In Scope

- Current Git status audit.
- Work package classification.
- Staging manifest recommendations.
- Evidence and cleanup-risk report.
- New task-memory files for recovery.
- Read-only or additive documentation/memory changes.

## Out of Scope

- Deleting files.
- Running `git clean`, `git reset`, or broad revert commands.
- Staging, committing, pushing, or deploying.
- Applying Supabase migrations to production.
- Rewriting existing business code while the cleanup package boundary is still being established.

## Current Baseline

Verified on 2026-07-02:

- Branch: `main`
- Staged files: 0
- Modified tracked files: 67
- Untracked files: 1248
- `git diff --check`: passed
- Large untracked/generated areas:
  - `screenshots`: 76M
  - `exports`: 59M
- Current untracked Supabase migrations:
  - `supabase/migrations/20260619193655_repairdesk_attachment_storage_repair.sql`
  - `supabase/migrations/20260620120000_customer_interactions_store_id_repair.sql`

## Acceptance Criteria

- A current worktree package plan exists.
- Every major dirty area has a recommended action.
- Destructive or release actions are explicitly held for owner approval.
- Follow-up staging can be done by explicit file list only.
- The final report includes screenshot/no-screenshot reasoning.

## Agent Plan

- Main thread only.
- No sub-agents spawned because this is a sequencing-sensitive dirty-worktree control task, and no write ownership should be split before the package boundaries are finalized.

## Verification Plan

- `git status --short`
- `git diff --name-status`
- `git diff --cached --name-status`
- `git ls-files --others --exclude-standard`
- `git diff --check`
- `du -sh` for large generated/evidence directories

## Rollback

The only intended writes in the first execution slice are additive task-memory files under this task directory. They can be removed as a scoped documentation rollback if the owner rejects this cleanup-tracking approach.
