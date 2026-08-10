# RepairDesk Multi-Agent Configuration

Status: active
Owner: Integration Lead
Last reviewed: 2026-06-18

This directory turns the project department rules into executable multi-agent operating material. The canonical policy remains `AGENTS.md` and `AI智能部门管理/部门化管理设计.md`; files here are the working prompts, task packets, and verification checklists used when a task requires delegated agents.

AI Company OS Codex Native v3.0 is available under `.ai-company/`, `.codex/`, and `.agents/skills/`. It supplies owner/CEO/task-flow/memory governance, reusable skills, and optional Codex-native specialist definitions for the project, while this directory remains the executable RepairDesk department configuration. If generic `.ai-company/policies/*`, `.agents/skills/*`, or `.codex/agents/*` rules conflict with RepairDesk-specific rules, `AGENTS.md`, `AI智能部门管理/部门化管理设计.md`, and this directory win.

## Required Flow

1. Read `AGENTS.md`.
2. For every new top-level window and applicable non-micro task, automatically invoke `$cross-session-orchestration`; stay `UNBOUND` until project/task/run/window identity is explicit and the immutable Context Packet verifies.
3. Read `.ai-company/REPAIRDESK_ADOPTION.md`.
4. Read `.ai-company/policies/CODEX_OPERATING_MODEL.md`, `.ai-company/policies/PROJECT_RULES.md`, and `.ai-company/policies/TASK_FLOW.md` for non-trivial tasks.
5. Treat `.ai-company/memory/ACTIVE_CONTEXT.md` as a foreground hint only; read the Registry-selected task under `.ai-company/memory/tasks/`.
6. Read `AI智能部门管理/部门化管理设计.md`.
7. Read this directory:
   - `.agents/repairdesk-multiagent.yaml`
   - `.agents/decision-flow.md`
   - `.agents/department-roster.md`
   - `.agents/task-package-template.md`
   - `.agents/integration-checklist.md`
   - `.agents/route-cases.yaml`
8. Load other task-relevant skills from `.agents/skills/*` only when useful.
9. Classify the request with the agenda intake.
10. Decide single-agent or multi-agent.
11. If multi-agent is required, spawn only bounded sidecar work that can run in parallel.
12. Keep final integration in the one top-level window holding the active integration lease.
13. Integrate, verify, update `.ai-company/memory/` when required, and report.

## Operating Model

RepairDesk uses a manager-led multi-agent model:

- A top-level Codex thread is a logical main thread, but only the active integration-lease holder is final Integration Lead.
- The Integration Lead is the only user-facing decision owner.
- Sub-agents are departments, not autonomous owners.
- Sub-agents are read-only by default.
- Scoped write is allowed only when file ownership is explicit and disjoint.
- No sub-agent may perform final merge, final validation, destructive commands, migration push, deploy, or secret handling.
- Sub-agents report blockers and disagreements back to the Integration Lead instead of asking the user directly.

Top-level cross-session orchestration is distinct from spawned sub-agents. Phase 0A does not remotely control arbitrary GUI windows and does not automatically spawn agents, create worktrees, transfer writers, integrate, commit, push, deploy, or migrate.

## Decision Owner Flow

Every delegated task follows this chain:

1. User gives the request to the Integration Lead.
2. Integration Lead creates an agenda intake and decides routing.
3. Integration Lead writes task packages for departments.
4. Departments work in bounded batches and return findings, patches, or verification notes.
5. Integration Lead runs the debate/arbitration pass.
6. Integration Lead performs final integration and reports validation.

The detailed decision workflow lives in `.agents/decision-flow.md`.

For complex T2/T3 or cross-domain requirements, the natural-language intake,
independent-view, single-writer, review, stop-condition, and no-spawn rules are
defined in [`docs/COMPLEX_REQUIREMENT_MULTI_AGENT_DECLARATION.md`](../docs/COMPLEX_REQUIREMENT_MULTI_AGENT_DECLARATION.md).

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
