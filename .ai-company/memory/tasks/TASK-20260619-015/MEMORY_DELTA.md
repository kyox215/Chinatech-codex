# Memory Delta — TASK-20260619-015

## Candidate project facts

- 2026-06-19 L2-011 removed 14 confirmed empty duplicate directories after exact inventory. Source: `DUPLICATE_DIRECTORY_AND_GENERATED_OUTPUT_REPORT.md`; status: active cleanup fact; owner: Operations + QA; review trigger: duplicate hygiene or broad source-tree search.
- Post-cleanup empty duplicate directory scan has no output, and Git-visible duplicate-file scan remains `same=0 diff=0 missing=0 nonfiles=0`. Source: EVIDENCE E-005/E-006; status: active cleanup fact.
- Ignored/generated duplicate-like output inventory contains 56 paths under `.next/`, `storybook-static/`, `playwright-report/`, and `test-results/`; these were intentionally not deleted in L2-011. Source: EVIDENCE E-003; status: residual generated-output hygiene; owner: Operations + QA.

## Candidate department updates

- Operations: source-tree duplicate file and empty duplicate directory cleanup is complete; generated output cleanup remains optional.
- QA: generated duplicate-like output must not be interpreted as source conflict; only clean/regenerate it when needed for reports/previews.
- Documentation: duplicate cleanup reports now distinguish source files, empty directories, and generated output.

## Candidate decisions / ADRs

- Decision: generated/ignored duplicate-like output should be handled separately from source-tree duplicate hygiene.

## Candidate lessons and capability evidence

- Lesson candidate: duplicate hygiene needs separate scanners for Git-visible source files, empty directories, and ignored/generated outputs.
- Capability evidence: Integration Lead completed path-scoped empty directory cleanup and separated generated-output inventory without deleting generated files.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
