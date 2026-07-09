# Memory Delta - TASK-20260709-015-phone-keypad-bottom-dock

## Candidate Long-Term Learning

- All custom in-app keypads, including phone, money, and PIN keypads, must use `VirtualKeyboardDock`; field-anchored `PopoverContent` is not acceptable for custom mobile keypads.
- E2E tests for mobile keypads should assert `data-virtual-keyboard-dock="true"`, CSS `position: fixed`, and lower-viewport placement, not only visibility.

## Not Stored

- No secrets.
- No customer PII.
- No production credentials.
