# Handoff

## Next Implementation Scope

Implement `docs/ORDER_DETAIL_DESKTOP_DENSITY_UI_PLAN.md` in small slices:

1. Bound the order detail Dialog width without changing form Dialogs.
2. Rebuild desktop overview into primary three-column + secondary aligned row.
3. Compress `DesktopOrderPhotosPanel`.
4. Adjust `OrderDetailActionDock` for 1024-1199 and 1200+ behavior.
5. Add/update visual overflow tests and screenshots.

## Guardrails

- Do not change mobile order detail behavior except to verify it remains intact.
- Do not change order workflow, payment, notification, attachment storage, or sensitive unlock logic.
- Preserve `@/lib/repairdesk/api` data boundaries.
- Preserve inline desktop status transition behavior.
