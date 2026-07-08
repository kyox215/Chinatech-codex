# Checkpoints — TASK-20260707-015-staff-display-name

## 2026-07-07T19:54:57Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.
## 2026-07-07T19:55:09Z — Added customer-facing staff display-name resolution so kyox120@gmail.com resolves to Alessio even if the stored staff profile name is a role label, and role-like display names fall back to readable email-derived names. Wired the resolver into request actor display names, order operator names, and immediate account profile update responses.

- **Phase:** verified
- **Completed/current state:** Added customer-facing staff display-name resolution so kyox120@gmail.com resolves to Alessio even if the stored staff profile name is a role label, and role-like display names fall back to readable email-derived names. Wired the resolver into request actor display names, order operator names, and immediate account profile update responses.
- **Next:** Ready for owner review. If accepted, stage only the scoped files for this task together with already-approved related task files if the owner requests a push/deploy.
- **Decision:** Kept permissions/role unchanged; only customer-facing/person display-name resolution changed. No production data mutation, push, or deploy.
- **Evidence:**
  - Files changed for this task: src/server/staff-display-name.ts; src/server/staff-display-name.test.ts; src/server/auth-context.ts; src/server/repairdesk-shared.ts; src/features/platform/server/platform.repository.ts.
  - Validation passed: npx eslint scoped files; npx vitest run src/server/staff-display-name.test.ts src/features/platform/server/platform.repository.test.ts src/features/orders/testing/mock-api.test.ts; npm run typecheck; npm run lint; npm run test (84 files, 546 tests); npm run build after sandbox-external rerun due Turbopack port restriction.
  - Visual evidence: screenshots/TASK-20260707-015-staff-display-name/orders-new-dialog-recorder-alessio-scrolled.png shows the new-order recorder card with Alessio while the role chip remains highest admin.
- **Recorded by:** Integration Lead
## 2026-07-07T21:10:32Z — Customer-facing staff display names were isolated into clean main deployment commit c8829ba752dc33da0cd640c0f1c939036711fa16; kyox120@gmail.com and owner@repairdesk.local resolve to Alessio, role-like names fall back to person/email names.

- **Phase:** deployed_to_main
- **Completed/current state:** Customer-facing staff display names were isolated into clean main deployment commit c8829ba752dc33da0cd640c0f1c939036711fa16; kyox120@gmail.com and owner@repairdesk.local resolve to Alessio, role-like names fall back to person/email names.
- **Next:** No action needed unless production smoke test finds a display-name regression; if rollback needed, use Vercel rollback to dpl_Hci6Kayr51uZgQaXFSvAt2qt6y3Z or revert c8829ba.
- **Decision:** Reimplemented staff display-name changes manually in the clean clone instead of applying dirty-file patches from the main workspace, because auth-context/platform.repository/repairdesk-shared had unrelated WIP in the original worktree.
- **Evidence:**
  - Clean deploy clone /private/tmp/repairdesk-main-deploy-20260707; commit c8829ba; src/server/staff-display-name.ts and test added; auth context, operator name, and platform account return paths patched; npm run typecheck/lint/test/build PASS; Vercel production dpl_2JLZima5GdP7ZLGMsxBPYiEWq8ur READY for c8829ba.
- **Recorded by:** CEO-Orchestrator
