# RepairDesk Multi-Agent Configuration

Status: active
Owner: Integration Lead
Last reviewed: 2026-06-18

This directory turns the project department rules into executable multi-agent operating material. The canonical policy remains `AGENTS.md` and `AI智能部门管理/部门化管理设计.md`; files here are the working prompts, task packets, and verification checklists used when a task requires delegated agents.

AI Company OS Codex Native v3.0 is available under `.ai-company/`, `.codex/`, and `.agents/skills/`. It supplies owner/CEO/task-flow/memory governance, reusable skills, and optional Codex-native specialist definitions for the project, while this directory remains the executable RepairDesk department configuration. If generic `.ai-company/policies/*`, `.agents/skills/*`, or `.codex/agents/*` rules conflict with RepairDesk-specific rules, `AGENTS.md`, `AI智能部门管理/部门化管理设计.md`, and this directory win.

## Required Flow

1. Read `AGENTS.md`.
2. Read `.ai-company/REPAIRDESK_ADOPTION.md`.
3. Read `.ai-company/policies/CODEX_OPERATING_MODEL.md`, `.ai-company/policies/PROJECT_RULES.md`, and `.ai-company/policies/TASK_FLOW.md` for non-trivial tasks.
4. Read `.ai-company/memory/ACTIVE_CONTEXT.md` and the current task under `.ai-company/memory/tasks/` when present.
5. Read `AI智能部门管理/部门化管理设计.md`.
6. Read this directory:
   - `.agents/repairdesk-multiagent.yaml`
   - `.agents/decision-flow.md`
   - `.agents/department-roster.md`
   - `.agents/task-package-template.md`
   - `.agents/integration-checklist.md`
   - `.agents/route-cases.yaml`
7. Load task-relevant skills from `.agents/skills/*` only when useful.
8. Classify the request with the agenda intake.
9. Decide single-agent or multi-agent.
10. If multi-agent is required, spawn only bounded sidecar work that can run in parallel.
11. Keep the main thread as Integration Lead / CEO Agent.
12. Integrate, verify, update `.ai-company/memory/` when required, and report.

## Operating Model

RepairDesk uses a manager-led multi-agent model:

- The main Codex thread is always Integration Lead.
- The Integration Lead is the only user-facing decision owner.
- Sub-agents are departments, not autonomous owners.
- Sub-agents are read-only by default.
- Scoped write is allowed only when file ownership is explicit and disjoint.
- No sub-agent may perform final merge, final validation, destructive commands, migration push, deploy, or secret handling.
- Sub-agents report blockers and disagreements back to the Integration Lead instead of asking the user directly.

## Decision Owner Flow

Every delegated task follows this chain:

1. User gives the request to the Integration Lead.
2. Integration Lead creates an agenda intake and decides routing.
3. Integration Lead writes task packages for departments.
4. Departments work in bounded batches and return findings, patches, or verification notes.
5. Integration Lead runs the debate/arbitration pass.
6. Integration Lead performs final integration and reports validation.

The detailed decision workflow lives in `.agents/decision-flow.md`.

## Routing Examples

Reusable routing cases live in `.agents/route-cases.yaml`.

Example task packages live in:

- `.agents/examples/readonly-audit.md`
- `.agents/examples/scoped-write-worker.md`
- `.agents/examples/multi-department-review.md`

## Validation

Run these checks after editing agent rules:

```bash
npm run agents:config
npm run agents:templates
npm run agents:check
```

## Spawn Policy

Spawn sub-agents only when at least one condition is true:

- The user explicitly asks for sub-agents, departments, multi-agent work, or role simulation.
- The task crosses two or more business domains.
- The task changes workflow, payment, inventory, customer PII, auth, database, or external integrations.
- The task needs independent QA/security/product review while implementation continues.

Do not spawn agents merely because a task is large. If the next action is blocking and tightly coupled, do it in the main thread.

## Concurrency Rules

- Prefer 2-4 active sub-agents.
- Close completed agents before spawning more.
- Do not create duplicate agents for the same question.
- Workers must have disjoint file ownership.
- Explorers and QA agents should be read-only unless the Integration Lead explicitly grants scoped write.

## External Research Record

The user shared `http://xhslink.com/o/2dBaa7VMnkk` with the title "Codex多Agent配置指南". On 2026-06-18, direct browser access redirected to Xiaohongshu login and did not expose the post body. No unverified post content was imported into this repository.

This configuration therefore uses accessible primary/official sources and local project rules:

- OpenAI Agents SDK: manager-style agents and handoffs.
- Anthropic Claude Code subagents: project-level agent definitions and tool/permission scoping.
- Microsoft AutoGen Teams: team composition and termination/verification conditions.
- RepairDesk local rules: `AGENTS.md` and `AI智能部门管理/部门化管理设计.md`.
