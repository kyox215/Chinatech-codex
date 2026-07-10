# Realtime And Preload Coordination

Status: implemented in application code; production Realtime activation remains approval-gated.

## Runtime Model

`QueryFreshnessCoordinator` is the single cache-consistency boundary for intelligent preload,
Realtime invalidation, manual refresh, optimistic rollback, reconnect recovery, and store changes.
All business data remains in the in-memory TanStack Query cache.

- Feature query-option factories own the exact query key, request function, and freshness window.
- Screens and `AppPreloadBridge` consume the same factories, so an in-flight or warm request is reused.
- Business API responses use `Cache-Control: private, no-store, max-age=0`.
- The service worker does not persist authenticated business responses.

## Conflict Order

| Situation | Required behavior |
|---|---|
| Realtime event during preload | Cancel the request; reject an uncancellable old response through the group/store epoch guard. |
| Repeated events | Deduplicate event IDs, mark inactive queries stale, and debounce one active refetch per query group. |
| Manual refresh during preload | Route through the coordinator, cancel stale work, and immediately refetch active queries. |
| Realtime event during optimistic mutation | Hold the active refetch until mutation settlement; never restore a snapshot whose epoch is old. |
| Reconnect or long background resume | Mark affected domains stale and run one catch-up refresh. |
| Store switch or sign-out | Cancel old requests before cache removal; clear event/epoch state and ignore old-store events. |

## Preload Policy

Preloading starts only after an authenticated active-store context exists. It runs during browser idle
time, keeps at most two requests in flight, and prioritizes the current workspace. Data Saver, `2g`,
and `slow-2g` connections preload only the first two targets. The current targets are the default order
queue, order workflow, store settings, default customer page, and inventory summary.

`NEXT_PUBLIC_REPAIRDESK_PRELOAD_ENABLED=0` disables only preloading. Realtime and ordinary screen
queries continue to work.

## Realtime Policy

Private store/domain channels carry metadata-only invalidation events. The client refreshes Realtime
authentication before subscribing, filters by active store, and displays compact connection states in
the desktop app bar and mobile order header. `SUBSCRIBED` after an error triggers catch-up before the
state becomes `synced` and then `live`.

Application code remains default-off unless `NEXT_PUBLIC_REPAIRDESK_REALTIME_ENABLED=1`; server
broadcast remains default-off unless `REPAIRDESK_REALTIME_BROADCAST_ENABLED=1`. Enabling these in
production still requires the approved private-channel authorization migration, Dashboard
private-only verification, and the project Database Application Gate. A `main` code push alone does
not authorize or activate those production changes.

## Verification

- Coordinator tests cover stale preload rejection, burst coalescing, store isolation, and optimistic
  rollback protection.
- Provider tests cover auth-before-subscribe and reconnect catch-up state transitions.
- Tenant tests cover cancellation before old-store cache removal.
- Playwright checks one customer preload request across warm SPA navigation and verifies the compact
  mobile status at 390 px without page overflow.
