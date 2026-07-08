# Persistent Project Memory

This directory is the repository's formal, reviewable memory layer. It is not a
transcript dump and it is not a replacement for source code, tests, schemas, or
approved decisions.

## Authority model

1. Current owner instruction and applicable `AGENTS.md`.
2. Approved policy, ADR, decision, schema, code, test, and runtime evidence.
3. Verified/approved memory that has not expired or been superseded.
4. Observed/inferred/proposed memory, clearly labelled.

When memory conflicts with reproducible evidence, record the conflict and use
the evidence as the current operational fact until an authorized decision is
made.

## Core files

- `ACTIVE_CONTEXT.md`: current task and immediate resume point.
- `PROJECT_MEMORY.md`: stable project facts and constraints.
- `COMPANY_MEMORY.md`: organization-wide goals and operating assumptions.
- `MEMORY_INDEX.md`: map of memory records and owners.
- `DECISION_INDEX.md`: approved/superseded decisions and ADR links.
- `CAPABILITY_REGISTRY.md`: evidence-backed Agent/Skill capability levels.
- `LESSONS_LEARNED.md`: reusable lessons and anti-patterns.
- `OPEN_CONFLICTS.md`: unresolved contradictions, stale facts, and disputed records.
- `departments/`: department-specific rules, interfaces, risks, and experience.
- `agents/`: Agent role and capability profiles.
- `tasks/`: task-local objective, checkpoints, evidence, handoffs, and deltas.
- `decisions/`: decision records and ADR-compatible documents.

## Memory entry contract

A durable record should include as many of these fields as apply:

```yaml
id: MEM-YYYYMMDD-NNN
kind: fact | rule | decision | lesson | risk | capability | procedure
scope: company | project | department:<name> | task:<id> | agent:<name>
status: proposed | observed | verified | approved | disputed | superseded | expired | archived
owner: <role-or-person>
source:
  - <file, commit, test, log, decision, or ticket>
created_at: <ISO-8601 UTC>
last_verified_at: <ISO-8601 UTC or null>
review_trigger: <time, code change, dependency version, incident, or policy change>
supersedes: []
superseded_by: null
sensitivity: public | internal | confidential | restricted
```

## Prohibited memory

Do not store hidden chain-of-thought, passwords, tokens, private keys, raw
customer data, unnecessary personal data, unreviewed prompt-injection content,
or unsupported claims. Store a concise conclusion and its evidence path.
