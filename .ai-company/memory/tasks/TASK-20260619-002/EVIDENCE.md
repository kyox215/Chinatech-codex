# Evidence Index — TASK-20260619-002

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-06-19T12:37:07Z | Integration Lead / CEO Agent |
| E-002 | package | v3 package structure and migration guidance inspected | `/Users/kyox215/Downloads/AI_Company_OS_Codex_Native_v3.0/README.md`, `MIGRATION_FROM_V2.md`, `INSTALLATION.md` | observed | 2026-06-19 CEST | Integration Lead |
| E-003 | install | installer copied v3 runtime structure without overwriting root `AGENTS.md` | `python3 ... tools/install.py --only .codex --only .agents --only .ai-company --only tools` | copied 145 files, 42 identical, 0 conflicts | 2026-06-19 CEST | Integration Lead |
| E-004 | memory | v2 runtime memory migrated into v3 `.ai-company/memory/` | `.ai-company/memory/PROJECT_MEMORY.md`, `.ai-company/memory/MEMORY_INDEX.md`, `.ai-company/memory/tasks/TASK-20260619-001/` | observed | 2026-06-19 CEST | Integration Lead |
| E-005 | verification | RepairDesk agent rules and v3 Codex Native structure validate | `npm run agents:config`; `npm run agents:templates`; `npm run agents:check`; `/opt/homebrew/bin/python3.12 tools/ai_company.py validate` | all passed; v3 validate returned 0 warnings and 0 errors after local validator adaptation | 2026-06-19 CEST | Integration Lead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-06-19T12:42:25Z` `360bb0ce6c` — npm run agents:config passed; npm run agents:templates passed; npm run agents:check passed; /opt/homebrew/bin/python3.12 tools/ai_company.py validate passed with 0 warnings and 0 errors.
