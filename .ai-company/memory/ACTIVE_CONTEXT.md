---
schema_version: 1
current_task_id: "TASK-20260831-001-project-i18n-clean-rebuild"
status: "active"
phase: "quality_gate"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "Hexiang Huang / Owner"
last_checkpoint_at: "2026-08-31T11:36:37Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**从远端干净基线重建网站核心中意英语言能力并发布**

## Current state

Core zh-CN/it-IT/en locale foundation, strict Cookie SSR, in-place language switcher, shell/navigation, public auth/invite/onboarding, localized metadata/manifest/offline recovery, primary module entry text, Rome/EUR formatters, AI locale propagation, tests, screenshots and architecture documentation are implemented on fresh origin/main baseline. Scope is corrected to the Owner-requested website language capability rather than a false claim that every historical domain string is translated.

## Blocking decisions

- None recorded. Check the task file and `OPEN_CONFLICTS.md` before assuming this remains true.

## Next action

Finish full R3 lint/typecheck/test/build and Chromium/WebKit browser checks; obtain final QA/security/release reviews; acquire integration lease; commit, non-force push exact SHA, deploy existing Vercel project and verify production.

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260831-001-project-i18n-clean-rebuild/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
