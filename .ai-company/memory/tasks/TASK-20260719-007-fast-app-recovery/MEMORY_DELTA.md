# Memory Delta — TASK-20260719-007-fast-app-recovery

- A global recovery shell is ready only when both the CSS marker and React runtime handshake are present.
- Mobile reconnect recovery must have an inline path that works without Next.js client chunks.
- `online` is only an acceleration hint; a fixed same-origin, non-SW-cached probe establishes reachability.
- Automatic reload is bounded to one per 60-second recovery window and follows direct stylesheet retry.
- Keep these facts task-scoped until production observation confirms the behavior; do not overwrite the concurrent Vision `ACTIVE_CONTEXT`.
- Do not use a full Next.js `/offline` document as the generic SW navigation fallback: WebKit can retain failed module loads and keep the first recovered document from starting its runtime.
- Use a dependency-free standalone fallback that only probes, reloads once per 60 seconds and offers manual recovery; the first recovered business document then loads Next resources for the first time.
- Production SW activation may delete only versioned `repairdesk-shell-*` caches, never unrelated business caches, authentication state, IndexedDB or outbox data.
