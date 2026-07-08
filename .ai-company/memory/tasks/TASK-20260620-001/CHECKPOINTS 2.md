# CHECKPOINTS

## 2026-06-20T00:17:58+02:00 Intake

- Classified as R2 / L2 scoped order workflow UI and service fix.
- No web research required.
- Single writer: main Integration Lead.
- Dirty worktree exists before this task; unrelated files must not be reverted.

## 2026-06-20T00:17:58+02:00 Implementation Started

- Plan: expose all enabled statuses in manual flow UI, embed desktop flow panel inside order detail, preserve automatic workflow constraints for approval and notification, and verify with targeted tests.

## 2026-06-20T00:28:14+02:00 Target flow implemented and verified

- Completed: manual order-detail status flow now lists all enabled non-current concrete statuses; desktop uses inline transition panel; mobile keeps Sheet; successful transition writes `status_changed`.
- Evidence: `ORDER_DETAIL_STATUS_TRANSITION_REPORT.md`; `EVIDENCE.md` E-002..E-016.
- Validation: targeted workflow/mock tests, lint, typecheck, full Vitest, targeted order desktop E2E, non-sandbox build, and agent rule checks passed.
- Residual risk: broader `npm run test:e2e:desktop` had one unrelated `/platform` 1440px `networkidle` timeout; dirty worktree contains unrelated files from adjacent tasks.
- Next: synchronize long-term memory and close the task if no new blocker appears.

## 2026-06-20T00:26:00+02:00 Verified

- Code implemented in orders model, detail screen, server repository, mock API, and tests.
- Static/unit/build gates passed.
- Browser-local check confirmed inline desktop transition panel and no old transition Dialog.
- API-local check confirmed status transition is recorded to timeline.
## 2026-06-19T22:32:58Z — Task closeout

- **Status:** closed
- **Outcome:** Order detail manual status transition repaired: any enabled concrete status except current can be selected; desktop flow is inline instead of second status Dialog; mobile Sheet retained; status_changed timeline events and safety guards verified.
- **Residual risks:** Dirty worktree contains unrelated adjacent task changes; broader npm run test:e2e:desktop has one unrelated /platform 1440px networkidle timeout; no database schema, production data, deployment, payment, tenant, or customer communication changes were performed.
- **Follow-up:** Investigate the unrelated /platform desktop E2E networkidle timeout if it repeats; keep stale Next server cleanup in QA runbook for E2E chunk errors.
- **Closed by:** Integration Lead / CEO Agent
