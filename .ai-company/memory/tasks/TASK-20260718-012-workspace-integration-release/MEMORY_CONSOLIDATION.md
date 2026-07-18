# Memory Consolidation — TASK-20260718-012

## Memory Change Set

| Candidate | Status | Destination | Source | Review trigger |
|---|---|---|---|---|
| Inventory V2 Web deployed but schema/RPC/allowlist/flags inactive; V1 retained | verified | `PROJECT_MEMORY.md`, `MEMORY_INDEX.md`, DATA/SEC/OPS/DOC memory | TASK-011 runbook, TASK-012 linked dry-run and env proof | before any V2 production activation |
| Exact-migration worktree after full dry-run exposes unrelated pending migrations | verified pattern | DATA/OPS memory | TASK-012 Phase 04 evidence | next linked migration release |
| Lifecycle purge retry-baseline proof flaw | verified risk | DATA/SEC memory | independent DATA/SEC review in TASK-012 | before any purge worker/scheduler/flag activation |
| Baseline-reproducible broad E2E locator failures | observed debt | QA memory | TASK-012 Phase 03 baseline comparison | dedicated E2E maintenance task |
| Second successful serialized scoped release | candidate capability evidence | `CAPABILITY_REGISTRY.md` | TASK-012 exact migration, main/deploy and runtime proof | after next cross-domain release or control failure |

## Conflicts and supersession

- No existing approved rule was overwritten.
- Inventory V2 migration absence is not recorded as a permanent fact; it is a current activation boundary that must be reverified live.
- Store lifecycle schema readiness is not treated as purge activation authority; the retry-baseline risk narrows the earlier dormant-schema evidence.

## Not promoted

- Temporary worktree paths, synthetic record contents, transient build waiting states and the full old-branch inventory are task-local evidence only.
- Deployment IDs remain in the task/CEO report for audit, while the durable rule is exact-SHA verification and rollback ownership.
- No secret, customer PII, raw device credential or production credential was copied into long-term memory.
