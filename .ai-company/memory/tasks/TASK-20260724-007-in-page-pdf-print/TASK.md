---
schema_version: 1
task_id: "TASK-20260724-007-in-page-pdf-print"
title: "当前页面生成并直接打印 PDF"
status: "active"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["DOC", "FE", "QA"]
created_at: "2026-07-24T11:22:54Z"
updated_at: "2026-07-24T11:42:31Z"
---
# Task — 当前页面生成并直接打印 PDF

## Owner request

当前页面生成并直接打印 PDF

## Business value

移除可见 about:blank 加载标签页，在订单页面显示生成进度并直接唤起系统打印预览。

## Scope in

- Replace the visible loading/PDF popup with a hidden same-page PDF print iframe.
- Show current-page progress for QR preparation, PDF rendering and print-preview launch.
- Preserve the four paper modes, fixed PDF bytes, QR behavior and all existing print entry points.
- Clean temporary iframe/object URL resources after print and on failure.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] 点击任一纸张模式后不打开可见新标签页。
- [x] 当前订单页面显示 PDF 生成进度提示。
- [x] 生成完成后自动唤起系统打印预览，四种纸张模式和二维码保持不变。
- [x] 失败时清理临时资源并显示明确错误。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Existing PDF generation remains unchanged | observed | `src/features/orders/print/fixed-order-pdf.ts` | verified |
| No visible popup is created | observed | Chromium E2E + local Chrome single-tab check | verified |
| Native print dialog behavior | observed | local Chrome hidden iframe `print()` path | verified on macOS Chrome; physical Windows/iOS remains operational coverage |

## Decision and approval points

- Local implementation and verification are within L2. Production deployment remains Owner-approved only and is not part of this task run.

## Work packages

- Implement hidden same-page print transport and progress toast.
- Verify cleanup/error behavior with unit tests.
- Verify four-mode zero-popup flow with Chromium E2E and local Chrome.
- Synchronize documentation and prepare a reversible local commit.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
