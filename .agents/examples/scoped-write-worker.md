# Example: Scoped Write Worker

Use this only when the Integration Lead has a disjoint file ownership plan.

```txt
task_id: worker-mobile-order-card-density-001
parent_task_id: orders-mobile-card-refresh
department: FE
department_id: FE
mode: scoped_write
status: queued
goal: Implement compact order list card layout using existing RepairOS patterns.
context: Order cards are too visually heavy and should show 3-4 cards per mobile viewport.
user_constraints:
  - Do not change API contracts.
  - Do not edit unrelated pages.
must_read:
  - AGENTS.md
  - docs/REPAIROS_MOBILE_DETAIL_STANDARD.md
  - src/shared/ui/repair-os-mobile.tsx
allowed_files:
  - src/features/orders/components/order-list-items.tsx
forbidden_files:
  - src/server/**
  - supabase/migrations/**
  - package.json
owned_paths:
  - src/features/orders/components/order-list-items.tsx
depends_on: []
blocked_by: []
expected_output:
  - Changed files list.
  - Implementation summary.
  - Local verification notes.
acceptance:
  - No horizontal overflow at 390px.
  - Typography matches RepairOS mobile detail density.
verification:
  - npm run lint
deadline: same-turn
handoff_to_integration_lead: true
```
