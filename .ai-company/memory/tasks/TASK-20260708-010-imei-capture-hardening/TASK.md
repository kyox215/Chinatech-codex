---
schema_version: 1
task_id: "TASK-20260708-010-imei-capture-hardening"
status: "active"
phase: "real-device-qa-ready"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "Integration Lead"
created_at: "2026-07-08T17:32:56Z"
updated_at: "2026-07-08T21:19:07Z"
---

# TASK-20260708-010 IMEI Capture Hardening

## Owner Goal

修复订单扫码 IMEI 无法正确启用摄像头的问题，适配手机端、电脑端、Chrome、Safari 等主流浏览器，并增强为：

- 扫码后如果有多个 IMEI，可以手动选择。
- 可以上传相册图片识别 IMEI。
- 纯数字图片或文本可以通过 OCR/文本解析读取。

## Business Value

前台和技师创建、编辑维修工单时能更可靠地录入设备 IMEI / 序列号，降低手输错误和订单设备信息丢失风险。

## In Scope

- 订单新建、订单编辑、订单详情内的 IMEI / 序列号采集入口。
- 摄像头启动兼容性、错误提示和降级路径。
- 条码/二维码结果的多候选解析与选择。
- 图片上传识别和 OCR/文本解析候选管线。
- 本地单元测试、相关 UI 验证和浏览器手测计划。

## Out of Scope

- 生产发布、部署、推送 main。
- Supabase schema 或生产数据迁移。
- 外部 OCR 服务、付费服务或上传图片到第三方。
- 清理无关脏工作区或历史治理文件。

## Constraints

- 主线程保留唯一写入权。
- 子代理只读复核，不修改文件。
- 不保存秘密、完整客户 PII、原始图片或不必要的设备标识日志。
- 不新增依赖，除非形成单独批准点。
- 保持 Next.js App Router 和 RepairOS UI 规则。

## Acceptance Criteria

- 摄像头在支持环境下由用户手势启动，关闭后释放。
- 不支持摄像头、非 HTTPS、拒绝权限、无摄像头、摄像头被占用时显示可操作降级路径。
- 单个有效 IMEI 可确认填入；多个候选必须手动选择。
- 上传图片可进入候选解析流程。
- 纯数字文本优先识别 15 位 Luhn 有效 IMEI；疑似值不得静默当作确定结果。
- 新建、编辑和详情入口行为一致。
- 相关测试和验证结果记录在 EVIDENCE/CHECKPOINTS。

## Agent Plan

- Kepler / solution_architect / ARCH-DATA / read_only / agent id `019f42c9-5bc3-7ba0-bd7c-b6084299c4c3`
- Aster / ux_reviewer / UX / read_only / agent id `019f42c9-9069-73d0-9829-ade56b5fd89f`
- Aegis / security_reviewer / SEC / read_only / agent id `019f42c9-b290-7521-ae47-67d25a78c9f0`
- Verity / qa_reviewer / QA / read_only / agent id `019f42c9-db7b-7012-977c-a6d1858eb145`

Follow-up read-only review after context resume:

- Kepler / solution_architect / read_only / agent id `019f42f4-9e3c-7a30-816b-19ec95b567c8`
- Sentinel / security_reviewer / read_only / agent id `019f42f4-bd6f-75a3-af9a-40caeaeb8ccd`
- Probe / qa_reviewer / read_only / agent id `019f42f4-db8e-71f2-9ce3-8eca105ec6cb`

Final read-only review for current execution batch:

- Gauge / qa_reviewer / QA / read_only / agent id `019f4325-3294-71d2-a6fe-d295724935cb`
- Cipher / security_reviewer / SEC / read_only / agent id `019f4325-5d63-7001-b39a-d17f48a84f27`
- Index / data_reviewer / DATA / read_only / agent id `019f4325-8e28-7e90-a1ac-6852ab4b1f19`

Real-device QA readiness review:

- Verity / qa_reviewer / QA / read_only / agent id `019f4347-d59f-7381-8d6a-045cbfc284f0`

Detail upload and authorization follow-up review:

- Delta the 2nd / data_reviewer / DATA / read_only / agent id `019f438c-f5fd-7d00-a448-b93fdbe64ddf`
- Cipher the 2nd / security_reviewer / SEC / read_only / agent id `019f438d-2264-73c2-9af7-075ae8d93b37`
- Verity the 2nd / qa_reviewer / QA / read_only / agent id `019f438d-54c0-7ad1-ab10-8e2e5ce39ba4`
- Aegis the 2nd / security_reviewer / SEC follow-up / read_only / agent id `019f4395-db08-71d0-9eba-547ba86d12fc`

## File Ownership Plan

Main thread may edit only task-relevant files after local inspection:

- `src/components/imei-scanner-field.tsx`
- `src/features/capture/model/barcode-parser.ts`
- order IMEI call sites under `src/features/orders/**`
- new shared parser/test files if needed under `src/shared/lib` or `src/features/*`

No database migration is planned.

## Verification Plan

- Targeted parser/unit tests first.
- Then `npm run lint`, `npm run typecheck`, targeted tests, `npm run test`, `npm run build` as feasible.
- UI/browser verification requires screenshots or a documented blocker.

## Implementation Summary

- Centralized IMEI/serial candidate extraction in `src/features/capture/model/barcode-parser.ts`.
- Added parser tests for Luhn validation, multiple IMEI candidates, suspect values, pure digit OCR text, labeled serial numbers, and generic barcode serials.
- Enhanced `ImeiScannerField` with inline camera error recovery, rear-camera preference, image upload, local OCR fallback where supported, manual entry, and multi-candidate selection.
- Updated order detail OCR flow to use the shared candidate parser, avoid displaying full OCR raw text, validate image size/type, and keep cancel available during OCR.
- Added component tests for unsupported camera recovery, multi-candidate camera scan, invalid upload type handling, uploaded-image barcode multi-candidate selection, and scanner cleanup on close.
- Added a gated Playwright E2E for the new-order IMEI capture dialog, covering browser-level camera fallback, uploaded-image OCR candidate parsing, candidate selection, and field fill.
- Fixed pure numeric OCR parsing for multiple adjacent 15-digit IMEI chunks separated by whitespace.
- Fixed scanner startup cancellation race so delayed `decodeFromConstraints` controls are stopped if the dialog closes before startup finishes.
- Sanitized unknown camera/image/OCR/save errors so raw browser/library/server messages are not shown in IMEI capture UI.
- Added OCR fallback component coverage for barcode decode failure followed by browser-native `TextDetector` candidates.
- Added dedicated IMEI Playwright config and verified Chromium/WebKit desktop + mobile viewport flows.
- Added HEIC/HEIF image selection compatibility for iPhone gallery photos in both shared IMEI capture and order-detail OCR entry points.
- Expanded IMEI Playwright coverage to six projects: desktop Chrome, desktop Safari, mobile viewport Chrome/Safari, Pixel Chrome, and iPhone Safari device descriptors.
- Exported the order detail `ImeiField` for focused component coverage and added a test proving uploaded-image multi-candidate selection reaches `onQuickSave`.
- Rejected blank `device_imei` inline patches in UI mutation, API schema, real order repository, and mock API to avoid empty order snapshots falling back to stale device IMEI values.
- Added mock API invariants proving an IMEI-only patch preserves customer linkage, device linkage, unlock PIN/password metadata, fault/finance/warranty fields, notes, and contact data.
- Changed the mobile order-detail IMEI sheet to use IMEI-specific sanitized save errors.
- Added timeout protection around uploaded-image barcode/OCR recognition so Chromium cannot remain stuck on `正在识别图片...`; barcode timeout falls back to browser-native OCR, OCR timeout shows a generic recoverable message.
- Added server-side inline patch limits for `device_imei`: nonblank, max 64 characters, and a conservative serial-safe character set.
- Added a task-local real-device QA package with browser matrix, HTTPS requirements, camera/gallery/OCR/save scenarios, and pass/fail criteria.
- Added camera startup fallback: if rear-camera constraints are overconstrained, retry with the browser's default camera instead of failing immediately.
- Fixed candidate deduplication so a single valid numeric IMEI is not duplicated as both IMEI and generic serial; single valid IMEI scans can auto-fill, while true multi-candidate scans still require manual selection.
- Added Chromium fake-camera E2E coverage proving a real browser media stream can be decoded by ZXing and auto-fill an IMEI in the new-order field.
- Added a real-device fixture generator that produces QR/text labels for camera, gallery, OCR, and multi-candidate manual QA.
- Added uploaded real-QR E2E coverage for both new-order IMEI upload and order-detail IMEI upload/save/refresh persistence.
- Tightened server-side order write authorization after SEC review:
  - `order/update` now resolves required permissions from full-update field categories;
  - repair, unlock, and warranty fields require `order:update_repair`;
  - full-update finance fields and `order/finance` require `payment:adjust`;
  - IMEI patch remains an intake write while `device_unlock` patch is no longer treated as intake-only.
- No dependency, database, API route, migration, deploy, push, or production data change.
