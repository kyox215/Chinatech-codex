# Checkpoints

## 2026-07-09T07:19:51Z

## Completed

- Created isolated worktree `/private/tmp/repairdesk-customer-phone-name-keypad` from latest `origin/main` to avoid contaminating the original dirty checkout.
- Implemented phone-only and name-only customer intake fields in new order.
- Implemented app virtual phone keypad and helper tests.
- Updated mobile E2E to verify phone keypad, phone results, name numeric warning, IMEI numeric input, and money keypad regression.
- Generated mobile screenshots for the phone keypad, phone result panel, and existing money keypad coverage.

## Decisions

- Did not change backend customer search API because the frontend now constrains phone/name query modes before calling the existing intake search endpoint.
- Realtime phone results are displayed above the phone input while the keypad opens downward; this keeps the full keypad visible and avoids covering the current result panel.
- Name field keeps native text input because names require a normal keyboard.

## Risks

- Backend search remains a shared customer intake search endpoint. Frontend prevents mixed query modes, but a future API-level `mode` parameter would make the separation stronger if needed.
- The original checkout remains dirty with unrelated kiosk task work; final staging and push must occur only from the isolated worktree.

## Next Step

Run final diff checks, stage only this task's files and screenshots, commit on `codex/customer-phone-name-keypad`, then push the commit to `origin/main`.
