---
schema_version: 1
task_id: "TASK-20260709-009-imei-iphone-scanner"
title: "Optimize iPhone IMEI scanner camera and photo OCR"
status: "verified"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["FE", "UX", "QA", "SEC"]
created_at: "2026-07-09"
---

# Task

## Owner Goal

Optimize the RepairDesk IMEI scanner for iPhone first: camera startup should be stable, scanner should prefer 2x/enhanced capture because 1x fails on real devices, photo OCR should be directly selectable, and candidate selection should remain clear.

## Business Value

Front desk staff can scan or OCR IMEI / serial numbers on real iPhones without repeated camera failures, manual typing, or wrong candidate selection.

## In Scope

- Shared IMEI scanner component.
- iPhone/mobile camera constraints and 2x/enhanced capture behavior.
- Photo OCR path from the current camera frame.
- Upload/photo recognition fallback messaging.
- Focused component tests and release validation.

## Out of Scope

- Server-side OCR service.
- Production data changes or database migrations.
- Unrelated kiosk staff review work in the main checkout.

## Acceptance Criteria

- Scanner starts from a clean `origin/main` baseline and does not include unrelated kiosk changes.
- Mobile scanner tries 2x/enhanced rear-camera constraints before falling back to 1x/default camera.
- Current-frame OCR is a dedicated action and can use browser OCR first, then local Tesseract OCR fallback.
- OCR and barcode failures produce actionable messages instead of only saying native OCR is unsupported.
- Multiple candidates remain selectable before committing the IMEI value.
- Relevant tests pass; broader gates are run or documented with environment limits.

## Rollback

Revert the commit containing `src/components/imei-scanner-field.tsx`, its tests, `package.json`, `package-lock.json`, and this task memory.
