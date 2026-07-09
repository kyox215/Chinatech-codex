# TASK-20260709-014 IMEI Overlay Value Binding

## Status

closed

## Owner Goal

Fix the IMEI scanner overlay mismatch where the visual box on the camera/photo preview can point to a different number than the selectable candidate.

## Business Value

Repair staff must be able to scan multi-IMEI labels quickly without choosing the wrong IMEI because the on-screen marker is attached to the wrong decoded value.

## Scope

- `src/components/imei-scanner-field.tsx`
- `src/components/imei-scanner-field.test.tsx`
- `src/features/capture/model/barcode-parser.ts`
- `src/features/capture/model/barcode-parser.test.ts`
- Task memory and evidence files for this task.

## Out Of Scope

- Camera constraints, zoom strategy, OCR engine choice, database schema, order data model, or production data.

## Acceptance Criteria

- A preview overlay box is shown only when a barcode detection can be matched to that exact candidate value.
- OCR-only or unmatched candidates remain selectable in the list but do not borrow another barcode's box.
- Overlay numbering follows visual top-to-bottom order in the preview.
- Overlay and candidate list display the same decoded value for each boxed candidate.
- Labeled serials such as `SN:AUN...` do not create an extra generic `SNAUN...` candidate.
- Focused component tests cover the no-wrong-box regression.

## Risk And Autonomy

- Risk: low to medium UX bug fix.
- Autonomy: L2 controlled execution.
- Approval: owner already requested execution.

## Rollback

Revert the task commit. No data migration or production data change is involved.
