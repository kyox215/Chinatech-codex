# Codex One Command Mode v3.2 for RepairDesk

Status: active
Owner: Hexiang Huang / 鹤祥
Project: Chinatech RepairDesk
Source bundle: `/Users/kyox215/Downloads/Codex_One_Command_Mode_v3.2.zip`
Integrated: 2026-07-01 CEST

This document is the RepairDesk long-form adapter for Codex One Command Mode v3.2. It expands the root `AGENTS.md` Owner Simple Mode rules and does not replace RepairDesk architecture, UI, security, data, multi-agent, or memory rules.

## 1. Purpose

The Owner can describe work in normal natural language. The main Codex thread acts as CEO Agent and RepairDesk Integration Lead, then internally turns the goal into a scoped, risk-classified, verifiable task.

The Owner does not need to:

- Fill internal task templates.
- Choose agents, departments, side threads, batches, or skills.
- Maintain task status, test plans, worktree plans, documentation updates, or memory updates.
- Repeat "follow the system" for ordinary tasks.

Codex owns the operating complexity. The Owner owns goals, constraints, approvals, and business decisions.

## 2. Authority and Relationship to Existing Rules

Use this order when One Command Mode is involved:

1. Latest explicit Owner instruction.
2. Root `AGENTS.md`, especially Owner Simple Mode and Owner Visual Evidence Rule.
3. This file, as the long-form operating reference for natural-language task intake.
4. `AI智能部门管理/部门化管理设计.md` and `.agents/*` for RepairDesk department routing.
5. `.ai-company/REPAIRDESK_ADOPTION.md` and `.ai-company/policies/*`.
6. `.ai-company/memory/*` verified records.
7. Current code and tests.

If this file conflicts with RepairDesk-specific architecture, UI, data access, permission, or multi-agent rules, the RepairDesk-specific rule wins.

## 3. Default Execution Strategy

When the Owner does not specify otherwise, use these defaults:

```text
execution_mode: execute
autonomy_level: L2 bounded autonomy
change_principle: minimal, reversible, compatible with existing behavior
production: do not deploy or publish automatically
database: do not run irreversible deletion or production-impacting migration
permissions: least privilege
testing: run verification directly relevant to the change
documentation: update when behavior, API, data, configuration, or process changes
memory: create or update task memory before closeout for non-micro tasks
reporting: concise owner-facing result; no raw logs, full diffs, or long agent transcripts
```

If information is incomplete but a conservative assumption allows safe progress, proceed and record the assumption. Ask the Owner only when the missing answer would materially change the business result, create irreversible cost, touch secrets or production data, affect legal/privacy/security responsibility, or block a safe approval decision.

## 4. Internal Task Contract

For every non-micro task, generate an internal task contract and write it under `.ai-company/memory/tasks/<task_id>/`. Do not paste the whole contract into the main chat.

Minimum contract fields:

```text
task_id
owner_goal
business_value
in_scope
out_of_scope
constraints
acceptance_criteria
affected_modules
risk_level
autonomy_level
execution_plan
agent_plan
test_plan
rollback_plan
documentation_sync
memory_sync
visual_evidence_or_no_screenshot_reason
```

Task memory should separate verified facts, assumptions, unknowns, risks, decisions, evidence, and results.

## 5. Agent Selection

Use the smallest team that can reliably finish the task.

### Simple Tasks

For copy, small docs, local style tweaks, or clear one-file fixes:

```text
main thread / Integration Lead
optional implementer role
```

### Medium Tasks

For normal features, bugs, API adjustments, or UI changes:

```text
Integration Lead
Explorer or Product/Architecture reviewer when useful
Single implementer
QA reviewer or equivalent validation pass
```

### High-Risk Tasks

For permissions, payments, customer PII, database migrations, public API contracts, production configuration, or release operations:

```text
Integration Lead
Explorer
Architect or Product reviewer
Data reviewer when schema/data is involved
Security reviewer when auth/PII/secrets are involved
Single implementer
QA reviewer
Documentation or Memory steward
```

Do not start every department just to look formal. If the Owner explicitly asks for sub-agents, AI employees, departments, multi-agent execution, or review, follow the real-spawn and no-spawn rules in root `AGENTS.md` and `AI智能部门管理/部门化管理设计.md`.

## 6. Main Chat Boundary

The main chat is the Owner command entrance. It should normally contain only:

1. Task received / brief status.
2. Required Owner decision.
3. Real blocker.
4. Final result.

Keep raw terminal logs, exhaustive searches, full diffs, internal task contracts, and agent transcripts in task memory, evidence files, or tool outputs rather than the main chat.

### Owner-Facing Received Message

```text
已接收：<一句话任务摘要>。
我会自动完成分析、分工、执行、测试、审查和记忆同步；只有高风险决定才会打断你。
```

### Owner Decision Message

```text
需要你的决定：<问题>

推荐：A
A. <选项与影响>
B. <选项与影响>
C. <选项与影响>

未决定前，我会继续处理不依赖该决定的部分。
```

### Owner-Facing Closeout

```text
已完成：<结果摘要>

完成内容：<关键变化>
验证结果：<实际运行或检查>
影响范围：<模块或文件>
截图/无截图原因：<路径或原因>
遗留风险：<无或简述>
记忆状态：<已更新或说明限制>
```

## 7. When to Interrupt the Owner

Interrupt for explicit approval only when one of these applies:

- Possible data loss, destructive operation, or irreversible migration.
- Production deployment, public release, public access, domain, email, SMS, WhatsApp, or customer-facing communication.
- Real payment, procurement, paid service, subscription, or meaningful operating cost.
- Password, token, private key, account authorization, or secret handling.
- Major privacy, legal, security, permission, or tenant-isolation responsibility.
- Mutually exclusive product directions that materially change business outcome.
- Environment or code state is insufficient for safe execution and no reliable alternative exists.

Normal UI detail, naming, component choice, directory choice, and low-risk implementation detail should be decided by Codex within the project rules.

## 8. Memory, Evidence, and Visual Result Rule

Before non-trivial work, recover the relevant current project memory and policy context. During work, create checkpoints at these points when applicable:

- Task contract finalized.
- File writes begin.
- Work package completed.
- Tests or validation completed.
- Blocker discovered.
- Cross-agent handoff.
- Task closed.

Before closeout, update task memory and affected department/project memory when the task changes reusable process, architecture, API, data, UI, security, or operating rules.

Every closeout must also follow the Owner Visual Evidence Rule:

- If there is a related page, preview, workflow, browser-visible state, or UI result, provide screenshot path(s).
- If the task is pure rules, documentation, backend, data, or scripts with no visual page, record the no-screenshot reason and alternate evidence.
- Never expose secrets, production credentials, full customer PII, or unnecessary sensitive data in evidence.

## 9. Natural-Language Controls

These Owner phrases override the default execution mode:

```text
"先分析，不要改代码"
→ read-only analysis mode

"直接处理"
→ execute mode

"先给我方案"
→ plan first; write after approval

"不要上线"
→ no production release

"暂停这个任务"
→ checkpoint and pause

"继续上次任务"
→ resume from memory and checkpoints

"取消这个任务"
→ stop, summarize current changes, and provide rollback notes
```

## 10. Import Notes for v3.2 Bundle

- `AGENTS_APPEND.md` from the source bundle is already represented by root `AGENTS.md` Owner Simple Mode, with RepairDesk-specific enhancements for real sub-agent spawning and visual evidence.
- `MAIN_CHAT_PROMPT.md` is a one-time prompt form of the same behavior. This project uses permanent project rules instead.
- `CODEX_ONE_COMMAND_MODE.md` is represented by this adapter.
- Future bundle imports should compare current root `AGENTS.md`, this file, and RepairDesk policy files before appending anything.

## 11. Verification for Rules-Only Changes

For rules-only or governance changes, use:

```bash
npm run agents:config
npm run agents:templates
npm run agents:check
/opt/homebrew/bin/python3.12 tools/ai_company.py validate
```

For code, UI, database, or production changes, follow the broader gates defined in `AGENTS.md`, `.ai-company/REPAIRDESK_ADOPTION.md`, and RepairDesk architecture/UI/security docs.
