# Memory Delta — TASK-20260619-234449-l2-030-audit-project-for-similar-governanc

## Candidate project facts

- L2-030 found no P0 issues and no evidence that the L2-029 root real-sub-agent rule itself is broken.
- Similar governance execution drift remains in supporting surfaces: task-package schema/template parity, integration report screenshot/no-screenshot fields, checker coverage, task memory frontmatter normalization, department memory placeholders, and active-looking docs with stale legacy route examples.
- `npm run agents:check` can pass while contract drift remains, because current checker scripts assert older snippets and JSON parseability rather than full parity across YAML, templates, schemas, and reports.

## Candidate risks / backlog

- GED-001 P1: update sub-agent task package schema, Chinese template, and checker to require real-spawn fields.
- GED-002 P1: add screenshot/no-screenshot fields to integration report template/schema/run-log/checker.
- GED-003 P1: strengthen `agents:check` to verify new governance contracts.
- GED-004 P1: normalize nonstandard task memory frontmatter after verifying each task.
- GED-005 P2: decide whether the active Figma task should stay active, be resumed, closed, or marked on-hold.
- GED-006 P2: replace department memory `TBD` placeholders with real interfaces/capabilities or explicit `not_defined_yet` records.
- GED-007 P2: refresh or archive/banner active-looking docs with stale legacy route examples.

## Candidate lesson

- When a governance rule is added, update all five layers together: authority rule, working template, machine schema, checker, and closeout evidence/report format.
