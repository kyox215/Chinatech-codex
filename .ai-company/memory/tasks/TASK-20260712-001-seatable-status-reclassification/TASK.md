---
schema_version: 1
task_id: "TASK-20260712-001-seatable-status-reclassification"
title: "SeaTable RIPARAZIONE 状态重新分类"
status: "closed"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["DATA", "INT", "QA", "SEC"]
created_at: "2026-07-11T23:17:10Z"
updated_at: "2026-07-16T18:04:44Z"
closed_at: "2026-07-16T18:04:44Z"
---
# Task — SeaTable RIPARAZIONE 状态重新分类

## Owner request

SeaTable RIPARAZIONE 状态重新分类

## Business value

让FATTO、IN CORSO、到货、修好及通知状态按老板定义正确进入完成、处理中、取消分类。

## Scope in

- Make explicit SeaTable source states authoritative over misleading problem text.
- Include `parts_arrived`, `repaired`, and `notified` in the in-progress business group.
- Reclassify only the 24 proven mismatches in production import batch `chinatech-riparazione-20260711-v2`.
- Preserve money, tenant isolation, source provenance, and all unrelated business activity.
- Produce and rehearse both pre-commit rollback and selective post-commit recovery.

## Scope out

- Any work not required by the acceptance criteria.
- Schema changes, unrelated RLS remediation, other stores, and unrelated worktree changes.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] SeaTable强状态优先于问题描述，映射测试覆盖FATTO/IN CORSO/到货/修好/作废。
- [x] RepairDesk正在处理中分类包含到货、到货已通知、修好、修好已通知。
- [x] 仅精确修正导入批次中的24张错误工单，金额和其他店铺不变。
- [x] 备份、强制回滚演练、正式提交和提交后验收全部通过。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Production candidate set | observed | deterministic manifest + read-only preview | 24 exact rows |
| Production outcome | observed | `PRODUCTION_RECLASSIFICATION_RECEIPT.json` | committed and independently verified |
| Repository state | observed | `git status --short` | dirty before and after this task; no automatic commit |

## Decision and approval points

- Owner approved execution with `开始执行` after the status plan.
- Production transaction was permitted only after fresh backup and forced-rollback rehearsal passed.

## Work packages

- [x] Intake, risk classification, and deterministic production preview.
- [x] Import mapping and business-group implementation with tests.
- [x] Fresh minimized backup and forced-rollback rehearsal.
- [x] Exact production commit and independent verification.
- [x] Selective post-commit recovery rehearsal.
- [x] Full quality gate, documentation, and memory checkpoint.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.

## Closeout status

Business and production objectives are complete. Repository packaging was recovered onto latest `origin/main`, independently reconciled with the later notification/handover fix, and passed targeted plus full regression gates under TASK-20260716-004. No production action was rerun.
