# Codex Subagent Orchestration Runbook

## Goal

Use parallel specialists only where they improve independent evidence or review,
while keeping one accountable main thread and one application-code writer.

## Team selection

Create subagents when the task is T2/T3, crosses domains, has ambiguity that can
be investigated independently, or needs separation of duties. Do not create
subagents for T0 or tightly sequential work.

Recommended combinations:

| Situation | Read-only specialists | Writer / finisher |
|---|---|---|
| New cross-stack feature | product_analyst, project_explorer, solution_architect | implementer |
| Permission/data feature | project_explorer, data_reviewer, security_reviewer | implementer |
| UI regression | project_explorer, ux_reviewer, qa_reviewer | implementer |
| Migration | solution_architect, data_reviewer, release_reviewer | implementer |
| Project health audit | explorer + 2–4 domain reviewers | none by default |

## Work-package contract

Every spawned Agent receives:

- task ID and objective;
- exact question to answer;
- allowed files/tools and read/write mode;
- scope exclusions;
- required evidence format;
- output schema;
- stop/escalation conditions;
- time and context budget.

Example:

```text
Spawn project_explorer, data_reviewer, and security_reviewer.
Each is read-only and owns one independent work package below.
Wait for all results, then consolidate agreements, conflicts, evidence, and unknowns.
Do not create an implementer until the consolidated plan is approved.
```

## Consolidation

The CEO main thread must:

1. Normalize claims into facts, assumptions, findings, and recommendations.
2. Deduplicate repeated findings.
3. Compare cited evidence rather than voting by majority.
4. Resolve or log conflicts.
5. Select one coherent plan and state why alternatives were rejected.
6. Create a checkpoint before handing work to `implementer`.

## Safety

- Keep `max_depth = 1` unless a documented use case justifies deeper delegation.
- Do not let multiple writers share the same workspace.
- Subagent tool access never implies business authorization.
- Close completed threads and record their deliverables; avoid stale Agents
  continuing from superseded context.
