# Memory Delta — TASK-20260619-005

## Candidate project facts

- `TASK-20260619-005` reviewed the 32 differing duplicate files from L2-001. Corrected result: 18 remove-after-Owner-confirmation, 12 remove-after-domain-confirmation, and 2 backlog/salvage-only candidates. Source: `DIFFERING_DUPLICATES_REVIEW.md` corrected by `TASK-20260619-006`. Status: verified by explicit file-level table.
- Canonical order workflow semantics currently keep `mail_in_progress` and `repaired` in the repair/external-repair workflow stage until notification/pickup handling. Duplicate ` 2` files disagree. Source: `DIFFERING_DUPLICATES_REVIEW.md`. Status: conflict recorded; Owner/domain confirmation required before duplicate deletion.
- Duplicate migration files must not be merged into canonical migration history. Source: `DIFFERING_DUPLICATES_REVIEW.md`. Status: guardrail for cleanup task.
- `tools/ai_company.py validate` may hang in this dirty/large workspace because it calls `root.rglob("*.md")` before applying skip filtering. Source: validation attempt and stack trace. Status: tooling limitation, not a business-code failure.

## Candidate department updates

- QA/OPS: duplicate cleanup should use the `TASK-20260619-005` report as the decision package and should delete only Owner-approved batches.
- DATA/API: semantic-conflict migration/order-status duplicates require domain confirmation before deletion; no migration-content merge is recommended.
- FE: stale UI duplicates are cleanup candidates, but current visual behavior should be accepted before deletion if the Owner wants a UI sign-off.
- DOC: stale Cursor/docs duplicates should not override RepairDesk/AI Company OS current guidance; use canonical non-` 2` files as authoritative.

## Candidate decisions / ADRs

- Proposed cleanup rule: canonical non-` 2` files remain authoritative; ` 2` duplicates are evidence only until Owner-approved cleanup.

## Candidate lessons and capability evidence

- L2 review can safely classify duplicate-file cleanup risk without touching business code when evidence is stored in `.ai-company/memory/tasks/<task-id>/`.
- Capability review result: one successful duplicate-review task is evidence for C1/C2 governance hygiene work, but does not change permissions or autonomy. Repeated cleanup execution with tests is required before any capability upgrade.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
