# TASK-20260703-003-order-photo-preview

## Objective

Enable order device photo thumbnails to open an enlarged preview from the order detail page.

## Owner Request

The owner reported that device photos can be captured/uploaded but tapping an existing photo does nothing. The expected behavior is to enlarge the image for inspection and make the photo area feel complete.

## Scope

- Mobile order detail device photo thumbnails on `/orders/[id]`.
- Desktop order detail photo thumbnails in the overview panel.
- Shared preview dialog for existing uploaded order attachments.
- No changes to upload/camera capture data flow, storage schema, or production data.

## Implementation Summary

- Added `OrderPhotoPreviewDialog` as a shared order photo viewer.
- Converted mobile and desktop uploaded photo thumbnails into accessible buttons when a source URL exists.
- Kept empty/source-less attachment placeholders non-interactive.
- Added close control and previous/next controls for multi-photo orders.

## Files

- `src/features/orders/components/order-photo-preview-dialog.tsx`
- `src/features/orders/components/order-overview-tab.tsx`
- `src/features/orders/screens/order-detail-screen.tsx`
- `screenshots/TASK-20260703-003-order-photo-preview/order-detail-photo-preview-393.png`
- `screenshots/TASK-20260703-003-order-photo-preview/order-detail-photo-preview-desktop.png`

## Classification

- Task class: T1 UI interaction fix
- Risk: R1
- Autonomy: L2 controlled execution
- Departments considered: Product/UI, Engineering, QA
- Subagents spawned: none
- No-spawn reason: narrow UI interaction with single-file ownership pressure and faster safe validation in the main thread; no independent read-only department deliverable was needed.
