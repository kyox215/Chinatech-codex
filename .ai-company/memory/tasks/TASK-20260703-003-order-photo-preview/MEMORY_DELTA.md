# Memory Delta

## RepairDesk Order Detail Photos

- Uploaded order photo thumbnails should be interactive when a valid `signed_url` or `public_url` exists.
- Shared preview behavior should live in `src/features/orders/components/order-photo-preview-dialog.tsx`.
- Both mobile order detail and desktop overview photo panels should use the same viewer so photo inspection behavior stays consistent.

## Verification Note

- Local mock attachment upload through `/api/repairdesk/order/attachment/upload` is a practical way to seed browser verification data for photo preview tasks.
