# AI Company OS — RepairDesk Codex Native v3.0

Status: active
Owner: Hexiang Huang / 鹤祥
Project: Chinatech RepairDesk
Version: 3.0.0 + One Command Mode v3.2
Last updated: 2026-07-01 CEST

This directory is the formal AI Company OS layer for RepairDesk. It was upgraded from the earlier v2.0 document package to the Codex Native v3.0 structure.

## Current Authority

Use this order for everyday work:

1. Root `AGENTS.md`.
2. `.ai-company/ONE_COMMAND_MODE.md` for natural-language Owner task intake.
3. `.ai-company/REPAIRDESK_ADOPTION.md`.
4. `.ai-company/policies/*`.
5. `.ai-company/memory/*` verified/approved records.
6. `.agents/skills/*` process skills.
7. `.codex/agents/*` specialist agent definitions.
8. Legacy v2 files kept in this directory for reference only.

RepairDesk-specific architecture, UI, data, and security rules still override generic AI Company OS guidance.

## Important Directories

- `policies/`: v3.0 governance, engineering, task flow, security, data, QA, memory, skill, hook, and sub-agent rules.
- `memory/`: formal project memory used by v3 tools and hooks.
- `runbooks/`: executable operating runbooks.
- `templates/`: reusable deliverable templates.
- `automation-prompts/`: prompts for recurring governance checks.
- `overrides/`: examples for subdirectory `AGENTS.md` overrides.
- `runtime-memory/`: legacy v2 memory retained for traceability; do not use as the daily memory root.
- `ONE_COMMAND_MODE.md`: RepairDesk long-form adapter for Codex One Command Mode v3.2 and Owner natural-language task entry.

## Codex Native Companions

- `.codex/agents/`: project specialist agent definitions.
- `.codex/hooks.json` and `.codex/hooks/`: optional memory recovery and checkpoint reminders that require project trust before active use.
- `.codex/profiles/` and `.codex/rules/`: suggested execution profiles and high-risk command controls.
- `.agents/skills/`: reusable task/process skills.
- `tools/ai_company.py`: Python 3.11+ helper for task memory, checkpoints, context packets, closeout, and validation.

## Local Verification

On this Mac, use Python 3.12 for the v3 tool:

```bash
/opt/homebrew/bin/python3.12 tools/ai_company.py validate
```

RepairDesk rule checks remain:

```bash
npm run agents:config
npm run agents:templates
npm run agents:check
```
