---
schema_version: 1
task_id: "TASK-20260720-006-ai-ledger-fence-hotfix"
title: "AI 用量账本门店围栏热修复"
status: "conditional"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L1"
owner: "IntegrationLead"
departments: ["DATA", "INT", "QA", "SEC"]
created_at: "2026-07-20T06:48:24Z"
updated_at: "2026-07-20T12:59:08Z"
closed_at: "2026-07-20T12:59:08Z"
---

# Task — AI 用量账本门店围栏热修复

## Owner request

AI 用量账本门店围栏热修复

## Business value

恢复订单与视觉大模型的可计费用量预留，同时保留门店生命周期隔离和失败关闭。

## Scope in

- Add one forward-only Supabase migration that replaces the generic store
  lifecycle trigger on `public.ai_assistant_usage_buckets` with a table-specific
  trigger.
- Permit `store_id is null` only for the existing global quota identities:
  `scope in ('global_day', 'global_month')` with `request_kind = 'all'`.
- Preserve the existing active-store/lifecycle fence for store-day buckets,
  including the shared advisory lock and cross-store update rejection.
- Serialize lifecycle transitions with AI ledger writes and reject leaving the
  active phase while any provider reservation remains unsettled.
- Add focused migration-chain regression coverage and run the repository gates
  required for a database hotfix.
- Prepare production verification and rollback instructions without applying
  them until the Owner explicitly approves the production action.

## Scope out

- Changing AI prompts, models, natural-language parsing, limits, pricing,
  reservation/finalization algorithms, RLS policies, grants, or application UI.
- Editing already-applied migration files or repairing migration history.
- Backfilling, deleting, or rewriting usage data.
- Pushing Git, applying the migration to production, or deploying Vercel without
  separate Owner approval.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- Work only in the isolated clean worktree and keep the dirty primary checkout
  untouched.
- Keep ledger accounting fail-closed: no OpenAI dispatch may occur when budget
  reservation cannot be durably recorded.
- Keep AI usage tables private and do not broaden function/table privileges.

## Acceptance criteria

- [x] AI 全局日/月桶允许合法空 store_id，其他空 store_id 仍拒绝。
- [x] 活动门店费用预留/结算可用，关闭门店仍被拒绝。
- [x] 订单与视觉模型账本测试及全量门禁通过。
- [x] 精确迁移已生产应用，目录/ACL/RLS/聚合后检通过。
- [x] 唯一无 PII 订单文字 canary 与至少 15 分钟观察通过。

## Facts, assumptions, and unknowns

| Item                            | Type     | Evidence                                                                                                                | Status / next action                  |
| ------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Task title and initial metadata | observed | owner request                                                                                                           | verify scope                          |
| Production failure              | observed | 8 order-turn HTTP 503s aligned with 8 `STORE_LIFECYCLE_STORE_REQUIRED` database errors                                  | confirmed                             |
| Conflicting invariants          | observed | AI bucket constraint requires null store for global day/month, while the later generic trigger rejects every null store | confirmed                             |
| Provider dispatch               | observed | failed audit rows are `model_version=not_started` and no usage request rows were created                                | OpenAI was not called                 |
| Affected paths                  | observed | order text and inventory vision share `repairdesk_reserve_ai_usage`                                                     | both model paths affected             |
| Changelog compatibility         | observed | current Supabase trigger/migration guidance; no relevant trigger breaking change found                                  | forward migration remains appropriate |

## Decision and approval points

- Local implementation and validation: approved by the Owner's “修复” request
  under L1/R3 bounded execution.
- Exact scoped Git commit/push and production migration `20260720065246`: approved
  by the Owner on 2026-07-20. This does not approve a Vercel deploy, PR merge,
  another migration, Vision smoke, flag/policy/model/secret/quota change, or
  lifecycle mutation.
- Production apply, one non-PII order-text canary and the 15-minute observation
  completed successfully. Functional recovery is live. Closeout is conditional
  only because the remote hotfix branch has not been merged into `main`; the
  migration must be integrated before any later database release.

## Work packages

1. DATA: review SQL invariants, locking, idempotency, and rollback (read-only).
2. SEC: verify tenant/lifecycle isolation, grants, and fail-closed behavior (read-only).
3. INT: implement the single forward migration and focused regression tests
   (Integration Lead is the only writer).
4. QA: define and independently assess focused/full validation and release smoke
   checks (read-only).
5. Integration Lead: reconcile reviews, validate the final diff, checkpoint
   memory, and prepare the production gate.

## Planned verification

- Static migration-chain tests for the dedicated trigger and exact null-store
  exception.
- SQL behavior matrix: global insert/update accepted and global delete rejected;
  store-scoped active write accepted; null invalid scope rejected; store-id
  reassignment rejected; inactive/closed/missing store rejected; active-to-close
  transition rejected while a reservation exists and accepted after settlement.
- `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Migration list/dry-run or local reset when the environment safely supports it;
  otherwise document the exact infrastructure blocker and substitute evidence.

## Rollback and observability

- The migration performs no table rewrite, backfill, or data mutation; it
  rebinds the mixed-bucket trigger and adds one lifecycle reservation guard
  under a five-second lock timeout.
- Rollback is another forward migration that restores the prior trigger only
  after the AI provider path is disabled, because restoring the faulty trigger
  while AI remains enabled recreates the outage.
- Production smoke, once approved: execute one synthetic, non-PII order-text
  request; verify three bucket updates, one request row, no new
  `STORE_LIFECYCLE_*` errors, and no double charge. Vision stays off and is
  proven by the PostgreSQL/service test suite; a billable Vision smoke remains
  a separate D4 decision.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.

## Closeout status

- **Production outcome:** released and observed; no containment or rollback was
  required.
- **Conditional governance item:** commits on
  `origin/codex/ai-ledger-fence-hotfix-20260720` must be merged or cherry-picked
  into `main` before the next database migration. PR creation/merge was outside
  the approved action and local GitHub CLI authentication is unavailable.
- **Unchanged boundaries:** no Vercel deploy, Vision smoke, flag, model, policy,
  secret, quota, lifecycle mutation, customer communication or data rewrite.
