# Memory Delta — TASK-20260709-012-phone-lookup-mobile-stability

## Candidate Project Facts

- Customer lookup popovers in phone-first mobile flows should not open until the actual search threshold is reached. Current threshold: phone search after 3 digits; text search after 2 text characters.

## Candidate Department Updates

- UX/FE: For mobile inputs near virtual keyboards, avoid opening helper popovers on the first numeric digit if the popover only says more characters are needed. Keep the input anchored and wait until actionable search results can be requested.

## Candidate Decisions / ADRs

- None.

## Candidate Lessons And Capability Evidence

- A focused component regression test is sufficient to catch the first-digit popover regression even when browser screenshot verification is blocked by local port restrictions.
