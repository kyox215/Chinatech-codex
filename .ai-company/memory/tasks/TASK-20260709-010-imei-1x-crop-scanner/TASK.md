---
schema_version: 1
task_id: "TASK-20260709-010-imei-1x-crop-scanner"
title: "Use 1x camera preview with center-crop IMEI recognition"
status: "verified"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["FE", "UX", "QA"]
created_at: "2026-07-09"
---

# Task

## Owner Goal

The previous default 2x camera view is too close and requires pulling the phone away. Change the IMEI scanner so the camera stays at 1x while barcode/OCR recognition uses center-crop magnification.

## In Scope

- Shared IMEI scanner component.
- Scanner status labels and photo OCR guidance.
- Component tests and relevant UI validation.

## Out of Scope

- Server-side OCR.
- Production data/schema changes.
- Hardware-specific manual camera lens switching.

## Acceptance Criteria

- Default camera request no longer asks for hardware `zoom: 2`.
- Preview label communicates 1x camera plus center enhanced recognition.
- Photo OCR and center-frame recognition continue to crop and enlarge the center region.
- Tests assert the 1x camera constraints and center-crop draw region.
- Changes are verified and pushed to `main`.
