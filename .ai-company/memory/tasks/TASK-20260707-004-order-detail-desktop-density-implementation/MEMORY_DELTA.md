# Memory Delta

- Order detail desktop dialog now uses `componentOverlay.orderDetailWorkspace` / `overlayShell.orderDetailWorkspace` with a capped width ladder, while generic detail workspaces remain unchanged.
- Desktop overview now has a second aligned summary grid containing key information, a bounded three-tile photo panel, and a compact records summary.
- `OrderOverviewTab` accepts order `messages` so the desktop records summary can show notification history without opening the records tab.
- Desktop E2E audit now checks the capped dialog width, secondary grid presence, and bounded photo panel at 1536px.
- For local visual verification, use `localhost` instead of `127.0.0.1` so the request-origin guard does not reject API POST calls.
