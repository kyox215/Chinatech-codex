# OPEN MEMORY CONFLICTS

| Conflict ID | Topic | Type | Impact | Interim rule | Owner | Due/trigger | Status |
|---|---|---|---|---|---|---|---|
| CONFLICT-20260619-001 | Generic AI Company OS roles vs RepairDesk existing departments | governance | Duplicate roles could slow work or weaken project-specific authority | Use `.ai-company/REPAIRDESK_ADOPTION.md` mapping; RepairDesk `AGENTS.md`, `AI智能部门管理/部门化管理设计.md`, and `.agents/*` win over generic OS files | Integration Lead | Review when adding new agent role or changing department model | mitigated |
| CONFLICT-20260619-002 | Unrelated dirty worktree during docs/rules verification | verification | Full app gates may report failures unrelated to OS adoption | For docs-only adoption use agent rule checks; isolate final diff before interpreting failures | Integration Lead | Review before commit/PR or when code/UI files are included | open |

关键冲突解决前不得被摘要成单一“事实”。
