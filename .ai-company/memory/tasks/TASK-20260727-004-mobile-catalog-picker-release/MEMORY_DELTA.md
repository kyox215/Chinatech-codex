# Memory Delta — TASK-20260727-004-mobile-catalog-picker-release

## Candidate project facts

- Fixed catalog pickers for phone and touch-tablet workspaces should open list-first with `autoFocus={false}`; search/manual input remains visible but only requests the software keyboard after an explicit tap. Source: E-004/E-008/E-009. Status: validated locally; promote after production/device smoke.

## Candidate department updates

- UX/FE candidate: use `useIsCompactWorkspace()` rather than the phone-only breakpoint for long touch-first catalog pickers; retain anchored Popover at desktop widths.
- QA candidate: prove no-autofocus separately from scroll ownership. Chromium can use `Input.synthesizeScrollGesture` for native touch evidence; mobile WebKit automation requires a scroll-owner fallback plus physical-device smoke.

## Candidate decisions / ADRs

- None yet.

## Candidate lessons and capability evidence

- A programmatically assigned `scrollTop` is insufficient as the only regression proof for touch-scroll conflicts; retain it only as a browser-engine fallback when the automation API has no real mobile gesture primitive.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
