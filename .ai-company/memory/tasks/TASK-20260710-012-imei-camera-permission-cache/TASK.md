---
schema_version: 1
task_id: "TASK-20260710-012-imei-camera-permission-cache"
title: "IMEI 扫码摄像头授权记忆与重复启动控制"
status: "closed"
task_class: "T1"
risk_level: "R2"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["FE", "SEC", "QA"]
created_at: "2026-07-10T20:39:58Z"
updated_at: "2026-07-10T20:39:58Z"
---
# Task

## Owner Goal

IMEI / 序列号扫码每次重新打开页面或浏览器时不要重复申请摄像头权限；允许一次后，后续尽量直接打开扫码。

## Scope

- IMEI scanner camera startup logic.
- Persist only a local, non-sensitive camera access preference.
- Avoid effect dependency changes that restart the camera after fallback mode selection.
- Unit coverage for reusing the last working camera mode.

## Security Boundary

Browser and operating-system camera indicators cannot be hidden by application code. The app must still call `getUserMedia` when it needs a fresh camera stream after page/browser reload, and the browser may still show its required camera-use indicator or prompt depending on user-agent policy.

This task stores only `{ granted: true, mode, updatedAt }` in `localStorage`; it does not store images, video, IMEI values, device IDs, customer data or permissions tokens.

## Result

- Successful camera startup remembers the working mode in local storage.
- Reopening the scanner after remount prefers the remembered mode, avoiding the failed high-resolution request chain when a lower mode was already proven to work.
- `activeCameraMode` state changes no longer rebuild the decode callback and restart the scanner.
- A `NotAllowedError` clears the remembered mode so future attempts do not assume permission still exists.
