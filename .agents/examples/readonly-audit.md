# Example: Read-Only Department Audit

Use this when the Integration Lead needs independent findings without file edits.

```txt
task_id: audit-customers-loading-001
parent_task_id: customer-management-performance
department: DATA
department_id: DATA
mode: read_only
status: queued
goal: Audit customer loading performance and API contract risks.
context: Customer management is slow or fails to load on mobile.
user_constraints:
  - Do not edit files.
  - Do not mutate the database.
must_read:
  - AGENTS.md
  - AI智能部门管理/部门化管理设计.md
  - .agents/repairdesk-multiagent.yaml
  - src/features/customers
  - src/lib/repairdesk/api.ts
allowed_files: []
forbidden_files:
  - "**/*"
owned_paths: []
depends_on: []
blocked_by: []
expected_output:
  - Query/API contract findings.
  - Pagination and lightweight field recommendations.
  - Server/client/mock consistency risks.
acceptance:
  - Findings are ordered by severity.
  - Each finding has a file reference or concrete code surface.
verification:
  - No commands that mutate files or data.
deadline: same-turn
handoff_to_integration_lead: true
```
