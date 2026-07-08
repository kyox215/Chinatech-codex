# Batch C Review Report — TASK-20260619-010

- Task: `TASK-20260619-010`
- Scope: review the two remaining Batch C backlog/salvage duplicate files.
- Boundary: no Batch C files were deleted, merged, staged, committed, pushed, or modified.
- Status: review complete.

## Executive Result

Batch C should not be merged directly into canonical files.

| File | Decision | Reason | Next action |
|---|---|---|---|
| `scripts/check-agent-rules 2.mjs` | delete-only candidate | It is an older standalone checker. Current canonical `scripts/check-agent-rules.mjs` delegates to modular checks, and the useful snippet/file/schema checks are already represented in `scripts/agents/check-agent-config.mjs` and `scripts/agents/check-agent-templates.mjs`. The duplicate also checks obsolete deprecated-file evidence. | Delete in a follow-up cleanup task after explicit path approval. |
| `tests/e2e/visual-overflow.spec 2.ts` | salvage-first backlog candidate | It proposes an attachment-inventory dialog stability check, but current source search found no current `附件库存` UI text. Direct merge would likely create a failing or stale E2E test. | Preserve the idea as a future E2E backlog item; delete the duplicate only after that backlog note is accepted or the scenario is intentionally implemented. |

## Evidence Summary

| Evidence | Result |
|---|---|
| Batch C source | `TASK-20260619-005` classified only these two files as backlog/salvage candidates. |
| Pre/post status | `git status --short -- <Batch C paths>` showed both files remain `??`. |
| Checker diff | Duplicate is 145 lines versus canonical 63 lines and hard-codes checks now split into modular scripts. |
| Current checker structure | `scripts/check-agent-rules.mjs` runs `scripts/agents/check-agent-config.mjs` and `scripts/agents/check-agent-templates.mjs`. |
| E2E diff | Duplicate replaces records workspace stability check with attachment-inventory stability check. |
| Source search | Current source contains `data-order-records-workspace`, but no current source hit for `附件库存`; the text appears only in the duplicate E2E file. |
| Validation | `npm run agents:check` passed. |

## Follow-Up Options

1. **Recommended:** create a tiny backlog note for the attachment-inventory overflow idea, then delete both Batch C duplicate files in a new L2 cleanup task.
2. **Alternative:** implement a real attachment-inventory E2E scenario only if the current UI has or intentionally adds that entry point.
3. **Not recommended:** copy either duplicate over canonical files.

## Residual Risks

| Risk | Level | Owner | Follow-up |
|---|---|---|---|
| Attachment-inventory E2E idea may be forgotten after duplicate deletion. | P2 | QA + UX | Record as backlog before deleting the duplicate. |
| Keeping Batch C files around continues duplicate-search noise. | P2 | Operations + QA | Delete after preserving the one useful future-test idea. |
| Active context drift can misroute future "continue" requests. | P2 | Memory + Integration Lead | Separate memory hygiene task for closed/unrelated active context records. |
