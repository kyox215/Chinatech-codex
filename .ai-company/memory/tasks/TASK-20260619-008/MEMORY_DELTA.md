# Memory Delta — TASK-20260619-008

## Candidate project facts

- Batch B semantic confirmation completed: all 12 Batch B duplicates are stale and should be deleted in a follow-up owner-approved cleanup task. Source: `BATCH_B_SEMANTIC_CONFIRMATION.md`. Status: verified by code, migration, and targeted test evidence.
- Current order workflow rule: `mail_in_progress` is repair/external-repair work, not intake. Source: canonical TS files, `20260619103000_order_external_repair_workflow.sql`, targeted tests. Status: verified current local rule.
- Current order workflow rule: `repaired` remains in repair until notification/pickup handling. Source: canonical TS files, `20260618172000_repaired_workflow_status_repair.sql`, targeted tests. Status: verified current local rule.
- Current order workflow rule: `quoted -> parts_ordered` remains a valid transition. Source: seed migration, mock workflow, server approval targets, mock API test. Status: verified current local rule.

## Candidate department updates

- Product/Data: mark CONFLICT-20260619-007 as confirmed/ready for cleanup rather than unresolved.
- QA/OPS: follow-up cleanup should delete only the 12 Batch B duplicate files and rerun the same targeted order tests plus `npm run agents:check`.

## Candidate decisions / ADRs

- Decision candidate: do not merge duplicate ` 2` Batch B files; delete them as stale after Owner approval.
- Decision candidate: do not rewrite historical canonical migrations for this cleanup; use forward migrations only after remote parity review if needed.

## Candidate lessons and capability evidence

- Evidence that duplicate semantic conflicts can hide real historical migration drift; confirmation must check later migrations, not only same-named canonical files.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
