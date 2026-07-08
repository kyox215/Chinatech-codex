---
schema_version: 1
task_id: "TASK-20260709-003-imei-overlay-selection"
title: "IMEI 扫码冻结画面框选候选"
status: "validated_pending_commit_push"
task_class: "T1"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["frontend", "qa", "ux"]
created_at: "2026-07-08T23:01:08Z"
updated_at: "2026-07-08T23:12:58Z"
---
# Task — IMEI 扫码冻结画面框选候选

## Owner request

IMEI 扫码冻结画面框选候选

## Business value

让手机端扫码后直接在相机/图片画面上选择识别到的 IMEI/SN，减少多条码场景选择成本并提升常见扫码体验。

## Scope in

- IMEI 扫码弹窗识别后冻结当前画面或上传图片预览。
- 对浏览器可提供位置的条码结果绘制可点击候选框，并同步候选列表选中状态。
- 保留无位置结果的候选列表降级，包括 ZXing、OCR、Safari/WebKit 和上传图片场景。
- 移动端高密度布局：候选态尽量一页内显示画面、候选、确认和底部操作；错误态不保留无效黑色视频占位。
- 更新单元测试、Playwright E2E 和截图证据。

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] 识别到带位置的条码后冻结当前画面并在画面中绘制可点击框，点框可同步选择候选。
- [x] 无条码位置的 OCR/ZXing 结果继续降级为候选列表选择，不阻断 Safari 等浏览器。
- [x] 底部操作栏在弹窗底部固定，扫描中/识别后/失败后按状态展示主操作。
- [x] 移动端候选态采用紧凑高密度布局，主要操作尽量保持在一页内可见。
- [x] 相关单元测试、移动 Chromium/WebKit E2E、fake camera E2E、完整回归和截图验证通过。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | done |
| IMEI scanner implementation surface | observed | `src/components/imei-scanner-field.tsx` | changed |
| Candidate parsing contract | observed | `src/features/capture/model/barcode-parser.ts` | reused unchanged |
| Mobile density need | observed | owner goal update | implemented and screenshot verified |

## Decision and approval points

- None registered yet. Run `$risk-autonomy-classify`.

## Work packages

- Component implementation: complete.
- Unit/E2E tests: complete.
- Mobile visual QA: complete.
- Quality gate and memory checkpoint: complete.
- Commit/push: pending at checkpoint time, to be completed by main thread immediately after memory update.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
