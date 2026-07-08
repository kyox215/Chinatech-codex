---
schema_version: 1
task_id: "TASK-20260709-002-imei-candidate-selection"
title: "完善 IMEI 摄像头候选选择流程"
status: "closed"
task_class: "T1"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["frontend", "qa", "ux"]
created_at: "2026-07-08T22:31:15Z"
updated_at: "2026-07-08T22:48:57Z"
closed_at: "2026-07-08T22:48:57Z"
---
# Task — 完善 IMEI 摄像头候选选择流程

## Owner request

完善 IMEI 摄像头候选选择流程

## Business value

手机端扫码或拍照识别后把 IMEI/SN 候选显示给用户选择，降低多条码无反应和误填风险。

## Scope in

- IMEI / serial candidate extraction for labeled multi-barcode payloads.
- `ImeiScannerField` camera, current-frame capture, uploaded image, barcode, and OCR candidate-selection flow.
- Unit, E2E, mobile Chromium/WebKit screenshots, and production build validation.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] 摄像头识别到单个或多个编号时不自动关闭弹窗，而是在下方显示候选并等待用户选择。
- [x] 上传图片、OCR 和当前摄像头画面拍照识别共用候选提取逻辑，能显示多个 IMEI/SN 候选。
- [x] 移动端状态提示不再在 HTTPS 页面误显示需要 HTTPS 或 localhost，按钮布局不产生横向溢出。
- [x] 相关单元测试和至少一个可视/E2E 验证通过。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Existing scanner auto-committed single high-confidence IMEI | observed | `src/components/imei-scanner-field.tsx` pre-change behavior | replaced with candidate-first flow |
| Multi-barcode labels need preserved context | observed | owner screenshot and `barcode-parser` tests | implemented for IMEI1, IMEI2, SN, ECID |
| Mobile dialog footer could be squeezed by action buttons | observed | Playwright screenshot | fixed with mobile grid footer and compact preview height |

## Decision and approval points

- No owner approval required beyond requested execution; no production data, database, secrets, or destructive changes.

## Work packages

- WP-01 Parser labels: completed and tested.
- WP-02 Candidate-first scanner UI plus current-frame capture: completed and tested.
- WP-03 Mobile Chromium/WebKit E2E and screenshots: completed.
- WP-04 Final validation and checkpoint: completed.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
