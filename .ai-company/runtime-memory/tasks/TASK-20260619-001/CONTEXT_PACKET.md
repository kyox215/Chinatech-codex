# CONTEXT PACKET

- Task ID: TASK-20260619-001
- Audience: future Integration Lead / AI employee recovering this task
- Generated: 2026-06-19 CEST

## Owner Request

The owner wants AI Company OS v2.0 written into this project and used so the owner can assign tasks to AI employees for processing.

## Required Rule Sources

- `AGENTS.md`
- `.ai-company/REPAIRDESK_ADOPTION.md`
- `.ai-company/PROJECT_RULES.md`
- `.ai-company/TASK_FLOW.md`
- `AI智能部门管理/部门化管理设计.md`
- `.agents/README.md`
- `.agents/repairdesk-multiagent.yaml`
- `docs/project-charter.md`

## Current Integration Decision

AI Company OS v2.0 is adopted under `.ai-company/`, but generic OS rules are subordinate to RepairDesk-specific rules. The main Codex thread remains Integration Lead and also acts as CEO Agent. Sub-agents/departments are AI employees that report to the Integration Lead.

## File Ownership For This Task

Owned by Integration Lead:

- `.ai-company/**`
- `docs/project-charter.md`
- `AGENTS.md`
- `AI智能部门管理/部门化管理设计.md`
- `AI智能部门管理/templates/agenda-intake.md`
- `.agents/README.md`
- `.agents/repairdesk-multiagent.yaml`

Do not edit unrelated existing source, Supabase, test, screenshot, or duplicate `* 2.*` files for this task.

## Verification

Use rules checks only unless code/UI changes are introduced:

```bash
npm run agents:config
npm run agents:templates
npm run agents:check
```
