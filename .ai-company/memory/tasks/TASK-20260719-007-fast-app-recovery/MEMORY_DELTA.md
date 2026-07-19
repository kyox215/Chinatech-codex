# Memory Delta — TASK-20260719-007-fast-app-recovery

- A global recovery shell is ready only when both the CSS marker and React runtime handshake are present.
- Mobile reconnect recovery must have an inline path that works without Next.js client chunks.
- `online` is only an acceleration hint; a fixed same-origin, non-SW-cached probe establishes reachability.
- Automatic reload is bounded to one per 60-second recovery window and follows direct stylesheet retry.
- Keep these facts task-scoped until production observation confirms the behavior; do not overwrite the concurrent Vision `ACTIVE_CONTEXT`.
