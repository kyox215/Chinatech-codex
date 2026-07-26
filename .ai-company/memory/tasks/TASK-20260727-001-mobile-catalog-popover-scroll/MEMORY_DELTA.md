# Memory Delta — TASK-20260727-001-mobile-catalog-popover-scroll

## Candidate project facts

- Mobile searchable catalog pickers that contain long lists should use a fixed keyboard-aware surface rather than an anchor-collision Popover. Source: E-002/E-007. Status: validated locally; promote only after release/device smoke.

## Candidate department updates

- Frontend/UX candidate: keep the search field and independently scrollable result list inside the same fixed mobile surface; retain anchored Popover on desktop.
- QA candidate: assert picker coordinates, list scrollTop, background scrollY and desktop container type separately.

## Candidate decisions / ADRs

- None yet.

## Candidate lessons and capability evidence

- Structural mobile viewport regressions can be detected without virtual-keyboard emulation by verifying that the mobile surface is not anchor-positioned and that its coordinates remain stable while the internal list scrolls.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
