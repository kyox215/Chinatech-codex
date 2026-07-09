---
schema_version: 1
task_id: "TASK-20260709-019-order-load-all-relationships"
title: "Fix all order embedded relationship ambiguity"
status: "closed"
phase: "validating"
task_class: "T1"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["API", "DATA", "DOC", "INT", "QA", "SEC"]
created_at: "2026-07-09T16:31:58Z"
updated_at: "2026-07-09T16:33:18Z"
closed_at: "2026-07-09T16:33:18Z"
---
# Task — Fix all order embedded relationship ambiguity

## Owner request

Fix all order embedded relationship ambiguity

## Business value

恢复线上订单列表加载，并防止 repair_orders 多外键嵌套关系逐个报错

## Incident Statement

- Owner reported that `/orders` still fails after the customer relationship fix.
- New production screenshot shows PostgREST error: `Could not embed because more than one relationship was found for 'repair_orders' and 'devices'`.
- Follow-up root cause: production has multi-store same-store FKs alongside legacy single-column FKs for `devices`, `suppliers`, and self-references, so unqualified embeds can fail one relationship at a time.

## Scope in

- Make all `repair_orders` order-list/detail embeds use explicit same-store relationship names.
- Cover `customer`, `device`, `supplier`, and `parts_supplier` relationships in shared order selects.
- Update the patch/edit path that separately embeds `device`.
- Add regression tests and source scans that reject ambiguous order embeds.
- Verify with tests, build, source scan, production schema query, and Data API syntax check.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.
- Database migration or broad Supabase `db push`.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [ ] repair_orders 的 customer/device/supplier/parts_supplier 嵌套全部使用显式 same-store 外键
- [ ] 生产外键只读查询确认同类多关系根因
- [ ] Data API 语法请求不再返回 PGRST201/more than one relationship
- [ ] 相关测试、lint、typecheck、全量测试和 build 通过

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Owner saw follow-up `devices` ambiguity | observed | owner screenshot | confirmed |
| Production has multiple `repair_orders -> devices` FKs | observed | Supabase read-only FK query | confirmed |
| Production also has multiple supplier/self relationships | observed | Supabase read-only FK query | confirmed |
| PostgREST requires `!<fk>` disambiguation for multiple FKs | observed | official PostgREST resource embedding docs | confirmed |
| Supabase changelog Data API grants change is not this symptom | observed | Supabase changelog; current error is PGRST201-style relationship ambiguity | confirmed |

## Decision and approval points

- Decision: use same-store relationships for order embeds, not legacy single-column FKs, to preserve tenant isolation and avoid further ambiguity.
- Owner asked to fix the still-broken production page after previously approving `main` push for this incident class; proceed through push after gates pass.

## Work packages

- WP-01: Confirm production FK ambiguity across order embeds.
- WP-02: Update order select constants and edit-path select strings.
- WP-03: Add regression tests/source scan.
- WP-04: Run tests, build, Data API syntax validation.
- WP-05: Checkpoint, commit, push `main`, close task.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
