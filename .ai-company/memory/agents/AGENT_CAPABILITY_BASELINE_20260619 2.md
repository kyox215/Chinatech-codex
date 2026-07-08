# Agent Capability Baseline — 2026-06-19

Source task: `TASK-20260619-003`

This file initializes all current RepairDesk Agent capability, permission, and limitation profiles. Individual agent files remain the durable per-agent profile; this baseline is the shared evidence snapshot for first takeover.

## Shared Operating Limits

- Default autonomy is L2 controlled execution unless the task reclassifies risk.
- Read-only review agents stay read-only unless the Integration Lead assigns scoped, disjoint writes.
- No agent may stage, commit, push, deploy, run destructive commands, execute production SQL, handle secrets, send external customer communication, or change payment/permission policy without explicit owner approval.
- The main Codex thread remains the user-facing Integration Lead and final decision integrator.
- Business-code edits were not authorized for this baseline task.

## Capability Table

| Agent | Level | Status | Default permission | Evidence | Limits / review trigger |
|---|---:|---|---|---|---|
| `project_explorer` | C2 | active | read-only preferred | Completed local project map in `PROJECT_TAKEOVER_REPORT.md` | Cannot modify or decide implementation alone; review on stale repo facts |
| `product_analyst` | C1 | active | read-only / docs when assigned | Product/business map and L2 task framing | Cannot invent business policy; review when owner intent is unclear |
| `solution_architect` | C1 | active | read-only / docs when assigned | Architecture map and `src/routes` debt identified | Architecture changes need separate task and verification |
| `implementer` | C1 | active | workspace-write when explicitly assigned | Existing v3 profile plus validation gates | No broad refactor, destructive cleanup, or overlapping ownership |
| `data_reviewer` | C1 | active | read-only by default | Migration/domain map and production-state unknowns identified | No production SQL or remote schema claims without approval |
| `security_reviewer` | C1 | active | read-only by default | Auth/role/tenant/secret boundary map | No secret exposure or live permission change |
| `qa_reviewer` | C2 | active | read-only by default | Ran/interpreted agents check, validation, lint, typecheck, test, build | Release approval still requires full acceptance and environment evidence |
| `ux_reviewer` | C1 | active | read-only / docs when assigned | UI rule baseline and responsive/design docs mapped | Needs screenshots/browser verification for visual claims |
| `documentation_reviewer` | C2 | active | docs/memory write when assigned | Synchronized project memory, conflicts, department files | Must not override RepairDesk rules with generic OS templates |
| `release_reviewer` | C1 | active | read-only / docs when assigned | Deployment/CI map and release unknowns identified | No deploy/promote/push authority |
| `memory_steward` | C2 | active | `.ai-company/memory` write when assigned | Created/updated task evidence, checkpoints, memory deltas, conflicts | Must keep unsupported facts and secrets out of memory |
| `capability_auditor` | C1 | active | read-only / docs when assigned | Initialized conservative capability evidence | Capability upgrades require stronger repeated evidence |

## Capability Review Notes

- Positive evidence exists for read-only exploration, QA gate interpretation, documentation synchronization, memory stewardship, and conservative capability classification.
- Most specialist agents remain C1 because this task did not exercise their full domain with independent positive, boundary, refusal, and recovery cases.
- `project_explorer`, `qa_reviewer`, `documentation_reviewer`, and `memory_steward` can be trusted for L2 support tasks under Integration Lead control.
