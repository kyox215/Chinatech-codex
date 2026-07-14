# WP-09 Read-Only Agent Packages

Decision owner and sole writer: RepairDesk Integration Lead / main thread
Nested agents: forbidden

## Architecture / API overlap reviewer

- Task: `/root/settings_integration_architecture`
- Department: Architecture + FLOW/API
- Mode: `read_only`
- Goal: map shared paths and provide semantic, file-level integration decisions.
- Forbidden: file edits, formatting, staging, commits, pushes, deployment, DB commands, secrets, nested agents.
- Required output: severity-ranked findings, conflict table, evidence, targeted tests, blockers.

## Security / data reviewer

- Task: `/root/settings_integration_security`
- Department: SEC + DATA
- Mode: `read_only`
- Goal: protect tenant isolation, authorization, PII, flags, migration boundaries, and contract parity.
- Forbidden: file edits, formatting, staging, commits, pushes, deployment, DB commands, secrets, nested agents.
- Required output: BLOCKER/MAJOR/MINOR findings, must-preserve invariants, tests, migration cautions, verdict.

## QA / release reviewer

- Task: `/root/settings_integration_qa`
- Department: QA + Release
- Mode: `read_only`
- Goal: define the exact local PR-ready gate, browser matrix, visual evidence, and production NO-GO criteria.
- Forbidden: file edits, formatting, staging, commits, pushes, deployment, DB commands, secrets, nested agents.
- Required output: test matrix, evidence requirements, gaps, rollback/release residuals, verdict standard.
