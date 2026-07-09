---
task_id: TASK-20260709-011-private-store-suppliers
updated_at: 2026-07-09T11:05:00Z
---

## 2026-07-09T11:05:00Z Memory Checkpoint

- Implementation complete in branch `codex/private-suppliers-20260709` from latest `origin/main` at task start.
- Private supplier data is store-scoped through `store_id`, permission-gated by `supplier:manage`, and exposed to orders through current-store options only.
- Mock fixtures start with an empty supplier list; tests create suppliers explicitly.
- Settings UI has responsive supplier section; order list/detail use reusable `OrderSupplierPicker`.
- Remaining release caveat: linked Supabase dry-run must be repeated from a linked checkout or with project ref before applying migration to production.
