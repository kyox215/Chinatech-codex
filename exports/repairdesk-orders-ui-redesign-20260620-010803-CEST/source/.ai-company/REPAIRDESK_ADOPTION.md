# RepairDesk AI Company OS Codex Native Adoption

Status: active
Owner: Hexiang Huang / 鹤祥
Business: Chinatech
Project: Chinatech RepairDesk
AI Company OS version: 3.0.0 Codex Native Edition
Last verified: 2026-06-19 CEST

This file connects AI Company OS Codex Native v3.0 to the existing RepairDesk repository rules. It is an adapter layer, not a replacement for the root `AGENTS.md` or the RepairDesk department system.

## 1. Operating Model

- Owner / 老板: Hexiang Huang / 鹤祥.
- CEO Agent: the main Codex thread for the current task.
- RepairDesk Integration Lead: the same main Codex thread unless the owner explicitly appoints another decision owner.
- AI employees: task-specific departments or sub-agents created by the Integration Lead.
- Codex Native specialists: definitions under `.codex/agents/*.toml`, used only when explicitly spawned by the Integration Lead.
- Process skills: reusable workflows under `.agents/skills/*/SKILL.md`, loaded only when task-relevant.
- Default autonomy: L2 controlled execution.
- Default language: Chinese for owner communication; Italian and English are supported when needed for customers, local business, UI text, or external services.

The owner gives goals and constraints. The CEO Agent / Integration Lead turns them into scoped work, assigns AI employees only when useful, integrates the result, verifies it, and reports back with evidence.

## 2. Rule Precedence

When rules conflict, use this order:

1. Latest explicit owner instruction.
2. Root `AGENTS.md`.
3. `AI智能部门管理/部门化管理设计.md` and `.agents/*`.
4. Existing RepairDesk architecture, UI, component, responsive, mobile, data, and security docs.
5. This adapter file.
6. Generic `.ai-company/policies/*` rules.
7. `.ai-company/memory/*` verified/approved records.
8. Existing code patterns.
9. Individual agent preference.

Generic AI Company OS documents, v3 skills, and `.codex/agents/*` must not override RepairDesk-specific Next.js App Router boundaries, RepairOS UI language, data access rules, Supabase/security constraints, or multi-agent permission rules.

## 3. Required Startup For Non-Trivial Tasks

Read in this order:

1. `AGENTS.md`.
2. `.ai-company/REPAIRDESK_ADOPTION.md`.
3. `.ai-company/policies/CODEX_OPERATING_MODEL.md`.
4. `.ai-company/policies/PROJECT_RULES.md`.
5. `.ai-company/policies/TASK_FLOW.md`.
6. `.ai-company/memory/ACTIVE_CONTEXT.md`.
7. `AI智能部门管理/部门化管理设计.md`.
8. Relevant `.agents/*` files when the task uses departments, skills, or sub-agents.
9. Relevant RepairDesk architecture, UI, API, data, and test files for the actual task.

Do not read every `.ai-company` file by default. Select task-relevant policy files such as `.ai-company/policies/SECURITY_POLICY.md`, `.ai-company/policies/DATA_API_STANDARDS.md`, `.ai-company/policies/QA_QUALITY_GATES.md`, `.ai-company/policies/DOCUMENTATION_POLICY.md`, or `.ai-company/policies/MEMORY_NATIVE_BRIDGE.md` when the work touches those domains.

## 4. Department Mapping

| AI Company OS role | RepairDesk execution role |
|---|---|
| CEO Agent | Integration Lead / INT |
| Chief of Staff | Integration Lead support duties |
| CKMO / Memory Steward | DOC with Integration Lead oversight |
| Context Orchestrator | Integration Lead context pass |
| Product Manager | FLOW |
| UI/UX Designer | UX |
| Frontend Engineer | FE |
| Backend Engineer | API |
| Data / Database | DATA |
| QA Lead | QA |
| Security / Privacy | SEC |
| Documentation | DOC |
| DevOps / SRE | INT plus task-specific QA/SEC unless explicitly delegated |
| Finance / Legal / Vendor | owner approval plus task-specific read-only review |

Only activate the departments needed for the task. Simple, local, low-risk work should remain single-agent.

## 4.1 Codex Native Agent Mapping

| Codex Native agent | RepairDesk department use |
|---|---|
| `project_explorer` | read-only evidence map before larger changes |
| `product_analyst` | FLOW / product workflow review |
| `solution_architect` | architecture and cross-module review |
| `ux_reviewer` | UX / RepairOS UI review |
| `data_reviewer` | DATA / schema, migrations, contracts |
| `security_reviewer` | SEC / auth, PII, secrets, threat model |
| `qa_reviewer` | QA / test and regression review |
| `documentation_reviewer` | DOC / documentation drift |
| `implementer` | the single default application-code writer when delegated |
| `memory_steward` | memory-only writer for `.ai-company/memory/` |

These files do not automatically create agents. The Integration Lead must explicitly spawn them only when the task justifies it.

## 5. Boss Task Intake

The owner may give a short instruction. If the task is non-trivial, the Integration Lead derives:

```txt
task_id:
owner_goal:
business_value:
hard_constraints:
definition_of_done:
autonomy_level: L2
decision_owner: Integration Lead / CEO Agent
business_domains:
technical_domains:
risk:
requires_multi_agent:
memory_required:
verification:
```

Ask the owner only when missing information would create a materially different business result, irreversible cost, legal/privacy risk, production data risk, or an unsafe approval decision.

## 6. Memory Rules

- `.ai-company/memory/` is the project memory root for AI Company OS v3.
- `.ai-company/runtime-memory/` is legacy v2 memory retained for traceability; do not create new task memory there.
- For non-micro tasks, create or update `.ai-company/memory/tasks/TASK-YYYYMMDD-NNN/` using the v3 format (`TASK.md`, `EVIDENCE.md`, `CHECKPOINTS.md`, `HANDOFF.md`, `MEMORY_DELTA.md`).
- Memory entries must separate facts, assumptions, decisions, risks, unknowns, and evidence.
- Do not store secrets, production credentials, full customer PII, hidden chain-of-thought, or unverified external claims as project facts.
- If memory conflicts with current code or root rules, current code/root rules win until the conflict is resolved and recorded.

## 7. Approval Boundaries

Owner approval is required for:

- Destructive commands, data deletion, production migrations, or irreversible changes.
- Payment, pricing, permission, authentication, tenant isolation, privacy, or customer communication changes with real-world effect.
- New paid services, procurement, subscriptions, or meaningful operating cost.
- Public release, deployment, domain, email, SMS, WhatsApp, or customer-facing notification.
- Major architecture shifts, dependency upgrades, framework replacements, or security exceptions.

## 8. Verification Defaults

Rules-only changes:

```bash
npm run agents:config
npm run agents:templates
npm run agents:check
```

Codex Native structure changes:

```bash
/opt/homebrew/bin/python3.12 tools/ai_company.py validate
```

`tools/ai_company.py` requires Python 3.11+. Do not report Codex hooks as trusted or executed unless they were actually reviewed and trusted in the target Codex environment.

Code or UI changes:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

UI changes also require relevant mobile/desktop checks from the RepairDesk UI and responsive docs. If unrelated worktree changes contaminate a gate, report that clearly and isolate the intended diff before interpreting the failure.
