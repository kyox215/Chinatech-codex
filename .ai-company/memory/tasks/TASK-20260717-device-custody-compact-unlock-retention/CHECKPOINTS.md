# Checkpoints — TASK-20260717-device-custody-compact-unlock-retention

## 2026-07-17T18:42:55Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.
## 2026-07-17T18:43:06Z — Owner approved executing the device custody compact mobile UI and unlock-retention rule, including linked Supabase migration. Implemented compressed mobile custody card, combined mobile assignee/supplier controls, retained unlock credentials across customer-held/returned custody, and added migration 20260717182220 to drop the customer-custody unlock-clear constraint and replace affected RPCs.

- **Phase:** verifying
- **Completed/current state:** Owner approved executing the device custody compact mobile UI and unlock-retention rule, including linked Supabase migration. Implemented compressed mobile custody card, combined mobile assignee/supplier controls, retained unlock credentials across customer-held/returned custody, and added migration 20260717182220 to drop the customer-custody unlock-clear constraint and replace affected RPCs.
- **Next:** Stage only this task scope, commit, push main, then verify origin/main and report linked Supabase migration 20260717182220 plus screenshot screenshots/device-custody-retain-unlock-mobile.png.
- **Decision:** Owner request in current turn explicitly authorized applying Supabase and migration; new business rule is unlock credentials are retained until manual clear, with unlock:read projection still protecting plaintext.
- **Evidence:**
  - npm run lint; npm run typecheck; npm run test; npm run build with sandbox escalation; REPAIRDESK_E2E_BUSINESS_DESKTOP=1 playwright device-custody-order-flow 3 passed; supabase db push dry-run showed only 20260717182220; supabase db push applied; migration list includes 20260717182220; remote schema dump shows no old unlock-clear constraint and functions emit credentials_cleared false.
- **Recorded by:** IntegrationLead
