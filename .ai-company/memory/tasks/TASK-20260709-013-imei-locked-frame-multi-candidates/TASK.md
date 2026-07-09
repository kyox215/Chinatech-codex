---
schema_version: 1
task_id: "TASK-20260709-013-imei-locked-frame-multi-candidates"
title: "Locked-frame multi-candidate IMEI scanning"
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

After tapping IMEI scan, locking the camera frame should still surface all visible IMEI/SN candidates instead of stopping at the first barcode.

## In Scope

- Shared IMEI scanner component.
- Locked camera frame recognition and candidate merge logic.
- Candidate ordering so valid IMEI values are prioritized over generic serial values.
- Focused component regression tests.
- Visual smoke evidence.

## Out of Scope

- New barcode/OCR dependencies.
- Supabase, server API, order persistence, or production data changes.
- Kiosk staff review WIP in the main checkout.

## Acceptance Criteria

- A live camera hit freezes the frame, then continues multi-source recognition on the locked image.
- If the first barcode is a long serial but the locked image contains IMEI1/IMEI2 text or barcodes, the IMEI candidates are shown and prioritized.
- Barcode detections with boxes still render selectable overlays.
- Existing upload image, manual entry, and retry flows keep working.
- Validation passes and the change is pushed to `main`.

## Closeout

- Implementation and validation completed in isolated worktree `/private/tmp/repairdesk-imei-multi-candidates`.
- Release action: commit from `codex/imei-multi-candidate-lock`, rebase onto latest `origin/main`, then push to `main`.
