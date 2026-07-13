# Memory Delta - TASK-20260713-001-order-active-status-homepage

## Proposed durable changes

- Default order-home visibility is terminal-status based: completed and cancelled belong to history, while every nonterminal order remains operationally visible.
- Financial, handover or data-quality contradictions are historical/authorized exception lenses and do not pull terminal orders back into the default pending queue.
- Mobile order status filters use a fixed or wrapping layout and never horizontal scrolling.

## Status

- Implementation and verification complete; promote after independent review and successful `main` release.
