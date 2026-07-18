# Decision Index

| Decision ID | Title | Status | Date | Owner/approver | Scope | Record | Supersedes |
|---|---|---|---|---|---|---|---|
| DEC-20260712-001 | Global staff finance and archived-order policy | approved | 2026-07-12 | 鹤祥 | all RepairDesk stores | `TASK-20260712-002-global-staff-permissions/TASK.md`, `docs/ROLE_PERMISSION_CONFIGURATION_PLAN.md` | proposed Option A role package |
| DEC-20260712-002 | Technician order scope uses stable membership ID and legacy access fails closed | approved | 2026-07-12 | 鹤祥 / Security review | all RepairDesk stores | `TASK-20260712-002-global-staff-permissions/EVIDENCE.md` | mutable display-name fallback |
| DEC-20260716-003 | Separate retained customer history from valid finance/repair facts and require audited terminal actions | approved | 2026-07-16 | 鹤祥 | all RepairDesk stores | `tasks/TASK-20260716-003-customer-finance-order-correction-plan/TASK.md`, `docs/ORDER_LIFECYCLE_CORRECTION_STANDARD.md` | ambiguous `total_spent`, generic terminal overwrite and normal hard-delete guidance |
| ADR-20260718-001 | Bounded AI assistant uses existing BFF, no write tools and server-built business cards | proposed; default-off fake implementation accepted | 2026-07-18 | Integration Lead / Owner gates retained | RepairDesk AI Phase 0-2 | `decisions/ADR-20260718-001-bounded-ai-assistant-bff.md` | none |

## Status model

- `proposed`: under review; not binding.
- `approved`: binding within its stated scope.
- `rejected`: considered and not selected.
- `superseded`: replaced by a later decision.
- `expired`: review condition elapsed without renewal.

Use `.ai-company/templates/ADR_TEMPLATE.md` or
`.ai-company/templates/DECISION_LOG_TEMPLATE.md` for material decisions.
