# TASK MEMORY

- Task ID: TASK-20260619-001
- Status: closed
- Owner: Hexiang Huang / 鹤祥
- Decision owner: Integration Lead / CEO Agent
- Autonomy level: L2
- Created: 2026-06-19 CEST

## Owner Goal

Write the AI Company OS v2.0 rules from `/Users/kyox215/Downloads/AI_Company_OS_v2.0/` into this RepairDesk project and optimize the project operating model so the owner can assign work to AI employees for execution.

## Scope

- Copy AI Company OS v2.0 into the project.
- Add a RepairDesk-specific adapter layer.
- Update root and department rules so future tasks read and follow the new operating model.
- Initialize project charter and minimal runtime memory.
- Validate agent rules.

## Out Of Scope

- Business code changes.
- Production data or Supabase mutation.
- Deployment or release.
- Paid procurement, external customer communication, or autonomy escalation beyond L2.

## Facts

- Existing RepairDesk rules already define Integration Lead, departments, sub-agent permissions, and validation gates.
- AI Company OS v2.0 recommends copying the OS into a project directory and using project-specific adaptation for existing projects.
- The current worktree has unrelated modified/untracked files that must not be reverted or attributed to this task.

## Decisions

- Use `.ai-company/` as the project AI Company OS root.
- Keep RepairDesk root `AGENTS.md`, `AI智能部门管理/部门化管理设计.md`, and `.agents/*` as higher authority than generic `.ai-company/*` files.
- Map CEO Agent to RepairDesk Integration Lead.
- Use L2 controlled execution by default.

## Risks

- Procedural duplication if generic OS roles are treated as separate mandatory participants for every task.
- Verification contamination from unrelated worktree changes.
- Memory pollution if future agents store secrets, full customer PII, or unverified claims.

## Verification Plan

- `npm run agents:config` passed.
- `npm run agents:templates` passed.
- `npm run agents:check` passed.
- Full lint/typecheck/test/build was intentionally skipped because this task only changed docs/rules/memory files; unrelated existing source changes are present in the worktree.

## Closeout

AI Company OS v2.0 is now present under `.ai-company/`, mapped into RepairDesk through `.ai-company/REPAIRDESK_ADOPTION.md`, referenced by root `AGENTS.md`, and connected to the existing department/multi-agent configuration. Future owner tasks should use the CEO Agent / Integration Lead intake, department routing, task memory, and proportional verification rules established here.
