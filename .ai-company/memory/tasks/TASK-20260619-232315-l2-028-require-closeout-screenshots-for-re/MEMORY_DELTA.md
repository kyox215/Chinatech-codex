# Memory Delta — TASK-20260619-232315-l2-028-require-closeout-screenshots-for-re

## Candidate project facts

- New project-level closeout rule: every task final report must include screenshots of relevant task/result pages when a UI or browser-visible result exists.
- For docs/backend/data/scripts/non-UI tasks, final report and Evidence must state the no-screenshot reason and provide alternate evidence.
- Screenshots must avoid secrets, production credentials, full customer PII, and unnecessary sensitive data.

## Candidate department updates

- QA: add screenshot/no-screenshot check to closeout evidence expectations.
- Documentation: final report and task evidence templates must preserve the visual evidence rule.

## Candidate decisions / ADRs

- Owner instruction accepted as project operating rule under root `AGENTS.md` and `.ai-company/policies/*`.

## Candidate lessons and capability evidence

- Visual proof is part of task closure for RepairDesk; text-only completion is insufficient when a visible page/result exists.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
