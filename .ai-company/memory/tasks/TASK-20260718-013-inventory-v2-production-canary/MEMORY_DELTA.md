# Memory Delta — TASK-20260718-013-inventory-v2-production-canary

## Candidate project facts

- **Fact:** Inventory V2 production rollout uses six server-only Vercel flags, service-role-only RPCs and a store UUID allowlist. **Source:** E-021 to E-024. **Status:** verified. **Owner:** Integration Lead. **Scope:** RepairDesk production. **Review trigger:** flag contract, deployment platform or auth architecture changes.
- **Fact:** Chinatech single-store V2 canary was activated on 2026-07-18 while V1 mutations remained enabled and AI image recognition remained dormant. **Source:** E-024 to E-028. **Status:** verified. **Owner:** 鹤祥. **Scope:** Chinatech store only. **Review trigger:** second-store rollout, AI provider activation or V1 retirement.

## Candidate department updates

- None yet.

## Candidate decisions / ADRs

- **Decision:** Production rollback is feature-flag-first; preserve V2 data and V1 writes, and never use down migrations or deletion as the first response. **Source:** task contract and E-023/E-025. **Status:** accepted for this rollout. **Owner:** 鹤祥. **Scope:** Inventory V2 canary. **Review trigger:** V1 retirement design.

## Candidate lessons and capability evidence

- Staging schema/shadow before commands/UI exposed a directly observable legacy fallback and provided a low-risk proof of the rollback path. Production rollback-only SQL then verified command behavior without retaining synthetic data. Source: E-023 and E-025; status: verified; owner: Integration Lead; review trigger: next high-risk additive migration rollout.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.

## Documentation impact matrix

| Audience | Authority | Change | Verification |
|---|---|---|---|
| Operations / release | `docs/INVENTORY_PRODUCT_V2_RELEASE_RUNBOOK.md` | added dated production state, one-store boundary, dormant AI and evidence pointer | linked history/dry-run, staged deployments, rollback canary and runtime logs |
| Project / departments | `PROJECT_MEMORY.md`; data/operations/security/QA/documentation memories | superseded prior production-off statements without changing organization authority | task evidence E-020..E-028 |
| Future agents | `MEMORY_INDEX.md`, `CAPABILITY_REGISTRY.md`, task handoff | indexed closed task and recorded C1 candidate evidence with no permission/autonomy upgrade | closeout diff review |

## Consolidation result

- Promoted the durable one-store rollout contract, flags-first rollback rule and current production boundary.
- Did not promote deployment URLs, temporary worktree paths or momentary row counts beyond task evidence because they are release-specific and drift-prone.
- No conflict was found; the new task explicitly supersedes only the earlier Inventory V2 production-off statements.
