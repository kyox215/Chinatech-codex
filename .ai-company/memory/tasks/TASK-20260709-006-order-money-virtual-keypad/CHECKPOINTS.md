# Checkpoints

## 2026-07-09T00:39:33Z

## Completed

- Implemented shared in-app virtual money keypad for order amount entry.
- Replaced order amount entry fields in new order, edit order, order overview inline editor, mobile order detail finance editor, and payment dialog.
- Added unit and component tests for keypad draft rules and no-native-input keypad interaction.
- Updated mobile E2E coverage to assert phone/IMEI keyboard hints remain, while money entry uses the virtual keypad instead of a decimal input.
- Generated mobile browser screenshots for the keypad and new-order quotation section.

## Decisions

- Keep phone number and IMEI as native mobile keyboard inputs; only money fields move to the app keypad.
- Preserve intermediate money drafts such as `12.` inside the keypad flow so delete/decimal behavior stays predictable.
- Leave order data model, server APIs, schema, and payment calculations unchanged.

## Risks

- The virtual keypad changes amount entry interaction globally across order finance surfaces; mobile regression should focus on Popover placement in small screens and dialogs.
- `next build` fails inside the managed sandbox because Turbopack cannot bind a port; sandbox-external build passed with approval.

## Next Step

Run final diff checks, stage only scoped task files and screenshots, commit, push `main`, then report validation evidence and screenshot paths.
