---
task_id: TASK-20260709-011-private-store-suppliers
updated_at: 2026-07-09T11:05:00Z
---

## Candidate Memory

RepairDesk private supplier management now treats suppliers as store-private settings data. Default mock supplier list is empty; Settings owner/manager can create, edit, and archive suppliers; order list/detail can select active current-store suppliers as `parts_supplier_id`. Migration `20260709234000_store_private_supplier_management.sql` adds supplier contact/archive fields and store-scoped active indexes. Before production migration, run linked Supabase dry-run from a checkout with project ref.
