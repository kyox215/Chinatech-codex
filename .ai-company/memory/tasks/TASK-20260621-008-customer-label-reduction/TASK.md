# TASK-20260621-008 Customer Label Reduction

Status: verified
Owner: Integration Lead
Autonomy: L2 controlled execution
Risk: R1 reversible UI density change

## Owner Goal

Reduce customer label clutter while preserving customer tag filtering and tag management.

## Scope

- Customer desktop list no longer has a dedicated tag column.
- Customer list rows and mobile cards show only one prioritized customer tag plus `+N`.
- Customer detail tag list shows at most two prioritized tags plus `+N`.
- Customer filter and tag editing dialogs remain functional.

## Out Of Scope

- No data model, API, query, permission, order, inventory, or workflow changes.
- No changes to mobile order detail or mobile work-order/task pages.

## No-Spawn Reason

No sub-agents were spawned because this was a narrow UI display-density change with a single write owner and no schema/API impact.
