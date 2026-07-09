# Memory Delta - TASK-20260709-013-virtual-keyboard-dock

## Candidate Long-Term Learning

- Custom in-app mobile keypads in RepairDesk should use `VirtualKeyboardDock` instead of inline popovers or inline grids so they stay fixed bottom-center across content reflow.
- Option overlays that can open near the bottom of mobile order forms should prefer `side="top"` and respect `--rd-overlay-avoid-bottom` when a fixed virtual keyboard is open.

## Not Stored

- No secrets.
- No customer PII.
- No production credentials.
- No screenshots, because local browser/dev-server verification was blocked by sandbox port binding restrictions.
