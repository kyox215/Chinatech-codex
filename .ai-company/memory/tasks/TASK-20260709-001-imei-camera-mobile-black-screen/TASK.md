---
schema_version: 1
task_id: "TASK-20260709-001-imei-camera-mobile-black-screen"
title: "修复 IMEI 扫码移动端摄像头黑屏和反复启用"
status: "closed"
task_class: "T1"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["frontend", "qa", "ux"]
created_at: "2026-07-08T22:04:29Z"
updated_at: "2026-07-08T22:12:37Z"
closed_at: "2026-07-08T22:12:37Z"
---
# Task — 修复 IMEI 扫码移动端摄像头黑屏和反复启用

## Owner request

修复 IMEI 扫码移动端摄像头黑屏和反复启用

## Business value

让手机端和桌面移动尺寸下的 IMEI 摄像头扫码稳定显示预览，不反复启停，并保留上传图片和手动输入兜底。

## Scope in

- To be refined by `$company-task-intake`.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [ ] 移动端/窄屏打开 IMEI 扫码弹窗时摄像头只启动一次，不因布局重渲染反复 stop/start。
- [ ] 视频流 ready 后显式播放，避免真实手机出现摄像头占用但预览黑屏。
- [ ] 扫码失败、上传图片、多个候选和手动输入仍可用。
- [ ] 新增或更新回归测试覆盖摄像头启动稳定性。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Project implementation details | unknown | repository inspection required | investigate |

## Decision and approval points

- None registered yet. Run `$risk-autonomy-classify`.

## Work packages

- Intake, evidence gathering, planning, implementation, independent review, memory closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
