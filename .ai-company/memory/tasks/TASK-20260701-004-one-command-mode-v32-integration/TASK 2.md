---
schema_version: 1
task_id: TASK-20260701-004-one-command-mode-v32-integration
status: closed
owner: Hexiang Huang / 鹤祥
lead: CEO Agent / RepairDesk Integration Lead
created_at: 2026-07-01T09:30:00+02:00
closed_at: 2026-07-01T22:40:29+02:00
risk_level: R1
autonomy_level: L2
task_type: governance_documentation_integration
---

# TASK-20260701-004 One Command Mode v3.2 Integration

## Owner Goal

老板原始任务：`将这套逻辑加入到项目中`

Source artifact: `/Users/kyox215/Downloads/Codex_One_Command_Mode_v3.2.zip`

## Business Value

Make Codex One Command Mode v3.2 a durable RepairDesk project rule so the Owner can keep assigning tasks in natural language while future agents can discover the exact execution, memory, evidence, and no-template behavior from project files.

## Scope

In scope:

- Inspect the v3.2 zip package and current RepairDesk governance files.
- Add a project-specific long-form One Command Mode adapter.
- Link the adapter from root/project authority documents.
- Record task memory, evidence, no-spawn reason, and no-screenshot reason.
- Run rules/governance validation commands.

Out of scope:

- Business code, UI behavior, Supabase migrations, production deployment, secrets, payments, permissions, or customer communication.
- Copying the zip package verbatim without reconciling current RepairDesk rules.
- Reverting or cleaning unrelated dirty worktree changes.

## Classification

- Complexity: T1/T2 documentation and rules integration.
- Risk: R1 low; rules-only change, reversible by diff, no production or data write.
- Autonomy: L2 controlled execution; Owner approval not required for low-risk project documentation updates.
- Departments considered: INT, DOC/RULES, QA.
- Spawn plan: no real sub-agents spawned.
- No-spawn reason: the Owner did not request sub-agents or departments for this task; the work is a sequential rules-only integration with overlapping file ownership, so main-thread execution plus validation is lower overhead and safer.

## Acceptance Criteria

- `.ai-company/ONE_COMMAND_MODE.md` exists and captures the full v3.2 natural-language Owner mode in RepairDesk-specific terms.
- Root and project authority docs reference the adapter without duplicating or weakening existing Owner Simple Mode, real sub-agent, or visual evidence rules.
- Task memory records scope, risk, no-spawn reason, evidence, and no-screenshot reason.
- Rules-only validation commands are run, or any blocked command is recorded with the exact reason.
- No business code, database migration, production deployment, or secrets are touched.

## Verification Plan

Run:

```bash
npm run agents:config
npm run agents:templates
npm run agents:check
/opt/homebrew/bin/python3.12 tools/ai_company.py validate
```

Review:

```bash
git diff -- AGENTS.md .ai-company/ONE_COMMAND_MODE.md .ai-company/README.md .ai-company/REPAIRDESK_ADOPTION.md .ai-company/FILE_MANIFEST.md AI智能部门管理/部门化管理设计.md .ai-company/memory
```

## Verification Results

- `npm run agents:config`: passed.
- `npm run agents:templates`: passed.
- `npm run agents:check`: passed.
- `/opt/homebrew/bin/python3.12 tools/ai_company.py validate`: passed with 11 checks, 0 warnings, 0 errors.
- `git diff --check -- <scoped task files>`: passed.
- `rg -n "ONE_COMMAND_MODE|One Command Mode|一句话老板模式|Owner Simple Mode|TASK-20260701-004" AGENTS.md .ai-company AI智能部门管理`: confirmed references.

## Closeout

Final status: closed.

No screenshot required because this task changed only governance documentation and memory files; there is no related page, browser-visible flow, or UI state.

## Rollback

Revert this task's touched files only. Do not revert unrelated worktree changes.
