---
schema_version: 1
task_id: "TASK-20260709-012-imei-fast-lock-scanner"
title: "Fast-lock IMEI scanner recognition"
status: "completed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["FE", "UX", "QA"]
created_at: "2026-07-09"
---

# Task

## Owner Goal

Optimize IMEI scanner speed so aligning the phone to a barcode quickly freezes the frame and shows candidates without waiting on slow OCR or long decode loops.

## In Scope

- Shared IMEI scanner component.
- Fast center-crop barcode pre-scan.
- Lock/freeze UI status.
- Component tests, Playwright smoke, and build validation.

## Acceptance Criteria

- Center-crop assist runs at a fast cadence and uses a short barcode-only timeout.
- Live camera barcode results freeze the current frame immediately and avoid unnecessary multi-barcode waits when the raw value already contains IMEI/SN candidates.
- Locked frame status is visible and resets on retry/close.
- Existing photo OCR and upload flows keep working.
- Changes are verified and pushed to `main`.

## Closeout

- Implementation and validation completed in isolated worktree `/private/tmp/repairdesk-imei-iphone-scanner`.
- Release action: push commit from `codex/imei-fast-lock-scanner` to `main`.
