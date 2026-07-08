# Evidence

| ID | Type | Evidence | Result | Timestamp |
|---|---|---|---|---|
| E-001 | source | `unzip -l /Users/kyox215/Downloads/Codex_One_Command_Mode_v3.2.zip` | Source bundle contains `README.md`, `CODEX_ONE_COMMAND_MODE.md`, `MAIN_CHAT_PROMPT.md`, and `AGENTS_APPEND.md`. | 2026-07-01 |
| E-002 | current-state | `rg -n "Owner Simple Mode|一句话|自然语言|One Command|Visual Evidence|截图" .ai-company .agents AGENTS.md docs AI智能部门管理` | Current root `AGENTS.md` already contains Owner Simple Mode and Owner Visual Evidence Rule; policy files contain screenshot evidence rules. | 2026-07-01 |
| E-003 | implementation | `.ai-company/ONE_COMMAND_MODE.md` | Added RepairDesk-specific long-form adapter for Codex One Command Mode v3.2. | 2026-07-01 |
| E-004 | validation | `npm run agents:config` | Passed; Agent config check passed. | 2026-07-01 |
| E-005 | validation | `npm run agents:templates` | Passed; Agent template check passed. | 2026-07-01 |
| E-006 | validation | `npm run agents:check` | Passed; Agent config, template, and rule checks passed. | 2026-07-01 |
| E-007 | validation | `/opt/homebrew/bin/python3.12 tools/ai_company.py validate` | Passed; 11 checks, 0 warnings, 0 errors. | 2026-07-01 |
| E-008 | scoped-review | `git diff --check -- <task files>` | Passed; no whitespace errors in scoped files. | 2026-07-01 |
| E-009 | reference-check | `rg -n "ONE_COMMAND_MODE|One Command Mode|一句话老板模式|Owner Simple Mode|TASK-20260701-004" AGENTS.md .ai-company AI智能部门管理` | Confirmed new adapter references in root, adoption, README, department entry, project memory, documentation memory, manifest, and task memory. | 2026-07-01 |

## Visual Evidence

No relevant task page or browser-visible UI exists. This is a pure rules/documentation integration. Alternate evidence is the changed governance files and validation command results.
