# Evidence Index — TASK-20260717-device-custody-compact-unlock-retention

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-17T18:42:55Z | IntegrationLead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-17T18:43:06Z` `2f34d8a0fa` — npm run lint; npm run typecheck; npm run test; npm run build with sandbox escalation; REPAIRDESK_E2E_BUSINESS_DESKTOP=1 playwright device-custody-order-flow 3 passed; supabase db push dry-run showed only 20260717182220; supabase db push applied; migration list includes 20260717182220; remote schema dump shows no old unlock-clear constraint and functions emit credentials_cleared false.
