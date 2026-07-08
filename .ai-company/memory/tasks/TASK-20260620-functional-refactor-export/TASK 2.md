# TASK-20260620-functional-refactor-export

Status: verified
Owner: Integration Lead / CEO Agent
Requested by: Hexiang Huang / 鹤祥
Created at: 2026-06-20 CEST
Autonomy: L2 controlled execution
Risk: R1 documentation-only export

## Owner Goal

提取当前 RepairDesk 项目所有系统功能信息，整理成可交给 GPT/工程师重构项目的文档。不要 UI 设计方面内容，只要系统功能、订单、客户等功能、运行方式和重构参考。

## Scope

In scope:

- Create an independent export package under `exports/`.
- Document current system functions, routes, APIs, data contracts, runbook, and refactor notes.
- Include no UI design instructions.
- Include no secrets or full customer PII.
- Preserve dirty worktree and avoid unrelated edits.

Out of scope:

- Business code changes.
- Database schema changes.
- Running migrations.
- UI redesign or screenshots.
- Reading `.env.local`.
- Production deployment.

## Deliverables

- `exports/repairdesk-functional-refactor-context-20260620-CEST/README_FOR_REFACTOR.md`
- `exports/repairdesk-functional-refactor-context-20260620-CEST/SYSTEM_FUNCTIONAL_MAP.md`
- `exports/repairdesk-functional-refactor-context-20260620-CEST/RUNBOOK.md`
- `exports/repairdesk-functional-refactor-context-20260620-CEST/API_AND_DATA_CONTRACTS.md`
- `exports/repairdesk-functional-refactor-context-20260620-CEST/REFACTOR_NOTES.md`
- `exports/repairdesk-functional-refactor-context-20260620-CEST/FILE_MANIFEST.md`
- `exports/repairdesk-functional-refactor-context-20260620-CEST.zip`

## Acceptance Criteria

- Export package exists and contains the six core Markdown documents.
- Documents cover orders, customers, inventory, buyback, messages, settings, auth/onboarding, stores/platform, dashboard, capture/attachments, imports, audit, API, data, and run commands.
- Package excludes UI design material and secrets.
- Zip archive passes `zip -T`.
- Final report includes no-screenshot reason because this is a pure documentation export.

## Verification

- File count check: six core Markdown documents exist.
- Content size check: package contains 1,987 Markdown lines.
- Sensitive-data check: `.env.local` was not read or copied; no actual secret value was included.
- Archive check: `zip -T exports/repairdesk-functional-refactor-context-20260620-CEST.zip` returned OK.
- Archive manifest check: `zipinfo -1` confirmed the six documents are present.
- Code tests were not run because no runtime code changed.

## Agent Use

No real sub-agents spawned.

Reason:

- The owner requested implementation of the approved plan, not explicit multi-agent/departments.
- Available sub-agent policy only authorizes spawning when explicitly requested.
- Work is a single-writer documentation export; spawning would add coordination overhead and risk duplicate scans.

Departments considered:

- DOC: documentation structure and final package.
- DATA/API: API/data contract extraction.
- FLOW: business capability map.
- QA: verification checklist.

Execution:

- Main thread only.
