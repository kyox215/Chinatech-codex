# Memory Delta — TASK-20260723-004-startup-bootstrap-print-implementation

## Candidate project facts

- Shell cold-start authority data is provided by `GET shell/bootstrap`; legacy onboarding/context/AI endpoints remain fallback-only for 404/405/501. Source: E-002/E-003. Status: accepted. Owner: IntegrationLead. Scope: app shell. Review trigger: bootstrap contract change.
- Home workspace routes suppress cross-domain background preload during primary-page startup. Source: `docs/REALTIME_PRELOAD_COORDINATION.md`. Status: accepted. Owner: FE. Scope: preload coordinator. Review trigger: measured navigation regression.

## Candidate department updates

- QA release gate is green: 342 test files / 2289 tests, lint, typecheck and build passed; independent QA found no P0/P1. Source: E-006 through E-010. Status: accepted. Owner: QA. Review trigger: code changes before deployment.

## Candidate decisions / ADRs

- Single-order print is a separate capability from batch print/export. Manager and sales may print an authorized single order; technician remains object-scoped; viewer is denied. Source: E-004. Status: accepted. Owner: SEC/API. Review trigger: role matrix change.

## Candidate lessons and capability evidence

- Print readiness must be projected before click and paired with an exact recovery entry on every single and batch surface. Source: E-005/E-010. Status: accepted. Owner: FE/QA. Review trigger: new print surface.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
