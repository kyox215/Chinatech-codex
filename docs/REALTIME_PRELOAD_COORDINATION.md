# Realtime And Preload Coordination

Status: implemented; the Owner approved a simultaneous all-store production release on 2026-07-23.

Normative startup and print gate: [`STARTUP_PERFORMANCE_AND_PRINT_READINESS_DECLARATION.md`](./STARTUP_PERFORMANCE_AND_PRINT_READINESS_DECLARATION.md).

## Runtime Model

`QueryFreshnessCoordinator` is the single cache-consistency boundary for intelligent preload,
Realtime invalidation, manual refresh, optimistic rollback, reconnect recovery, and store changes.
All business data remains in the in-memory TanStack Query cache.

- Feature query-option factories own the exact query key, request function, and freshness window.
- Screens and `AppPreloadBridge` consume the same factories, so an in-flight or warm request is reused.
- Business API responses use `Cache-Control: private, no-store, max-age=0`.
- The service worker does not persist authenticated business responses.

## Conflict Order

| Situation                                 | Required behavior                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Realtime event during preload             | Cancel the request; reject an uncancellable old response through the group/store epoch guard.        |
| Repeated events                           | Deduplicate event IDs, mark inactive queries stale, and debounce one active refetch per query group. |
| Manual refresh during preload             | Route through the coordinator, cancel stale work, and immediately refetch active queries.            |
| Realtime event during optimistic mutation | Hold the active refetch until mutation settlement; never restore a snapshot whose epoch is old.      |
| Reconnect or long background resume       | Mark affected domains stale and run one catch-up refresh.                                            |
| Visible order workspace every 30 seconds  | Read only the store/domain revision; refresh order queries only when the version changed.            |
| Store switch or sign-out                  | Cancel old requests before cache removal; clear event/epoch state and ignore old-store events.       |

## Preload Policy

Preloading starts only after an authenticated active-store context exists. Workspace home routes
(`/`, `/orders`, `/customers`, `/inventory`, and `/settings`) treat every cross-domain target as
startup-owned and do not run background workspace preloads. This keeps the active page's primary
query free from database and network contention. Nested workflow/detail routes may still warm likely
next workspaces, with at most two requests in flight; secondary targets run during browser idle time.
Data Saver, `2g`, and `slow-2g` connections stop after the first two eligible targets; offline clients
do not preload. The order target always uses the same `orders/queue-summary` query factory as the
order workspace, never the legacy list-page cache key.

Once the order workspace is mounted, its single store-scoped scheduler warms at most the first two
visible order details on a normal connection and one on `3g`, always with detail concurrency limited
to one. It is the only automatic detail-preload owner; the application bridge warms workspaces but does
not run a second detail queue. Order links also schedule detail preload on focus and primary
pointer-down, or after a 100 ms hover intent. Pointer leave or focus-out removes work that has not
started, and the bounded queue keeps only the latest queued intent. The same detail query options are
used by preload, the detail dialog, and the standalone detail route, so fresh or in-flight data is
reused instead of requested again.

All detail work runs through the `orders.all` freshness group. Realtime invalidation, manual refresh,
store change, or sign-out advances that group's epoch before cancellation, preventing a late old-store
or stale preload response from becoming current data. Detail preload has a short two-minute garbage
collection window and does not persist authenticated business data.

Cold `/orders`, `/customers`, and order-detail loads render full RepairOS workspace skeletons rather
than a line of loading copy. Warm navigation and background refresh preserve the current workspace;
only the initial no-data state uses the skeleton.

`NEXT_PUBLIC_REPAIRDESK_PRELOAD_ENABLED=0` disables only preloading in the generated client bundle.
Because it is a public Next.js build-time variable, changing it requires a rebuild/redeploy; Realtime
and ordinary screen queries continue to work.

## Authority Bootstrap And Shell Stability

The initial workspace authority snapshot comes from private `shell/bootstrap`. The endpoint resolves
the request actor once, then projects onboarding, store context, AI capability, and the non-secret
customer-status QR readiness flag from that same actor snapshot. The legacy `onboarding/status`,
`stores/context`, and `ai/capabilities` endpoints remain available for compatibility and rollback.

Bootstrap is used only for cold hydration. The narrower `stores/context` request remains the 15-second
authority monitor, so polling does not repeatedly read onboarding and AI capability data. A real store,
membership, role, or permission fingerprint change still clears authority-sensitive query state.
Authorization failures clear bootstrap and tenant caches before paint; the client only falls back to
legacy startup endpoints when an older server explicitly returns 404, 405, or 501.

## Realtime Policy

Private store/domain channels carry metadata-only invalidation events. The client refreshes Realtime
authentication before subscribing, filters by active store, and displays compact connection states in
the desktop app bar and mobile order header. `SUBSCRIBED` after an error triggers catch-up before the
state becomes `synced` and then `live`.

Application code remains default-off unless `NEXT_PUBLIC_REPAIRDESK_REALTIME_ENABLED=1`; server
broadcast remains default-off unless `REPAIRDESK_REALTIME_BROADCAST_ENABLED=1`. The independent
`NEXT_PUBLIC_REPAIRDESK_REVISION_CHECK_ENABLED=1` switch enables a visible-and-online 30-second
version comparison on order routes. The comparison transfers only store-scoped domain/version
metadata and does not refetch business data when unchanged.

The 2026-07-23 release is approved for simultaneous activation across all stores. Production still
requires the private-channel authorization migration, Dashboard private-only verification, linked
database dry-run, tests, and a GO decision immediately before the flags are enabled. Global rollback
sets the three switches to `0`; private-channel RLS hardening remains in place.

## Verification

- Coordinator tests cover stale preload rejection, burst coalescing, store isolation, and optimistic
  rollback protection.
- Provider tests cover auth-before-subscribe and reconnect catch-up state transitions.
- Provider tests independently cover visible/hidden/offline 30-second checks, unchanged revisions,
  changed revisions, and cleanup.
- App-bridge tests cover stable first authority hydration and later permission-change remounts.
- Tenant tests cover cancellation before old-store cache removal.
- Detail scheduler tests cover priority, deduplication, cancellation, network limits, and single-request
  reuse from pointer/focus intent through dialog open.
- Playwright checks the bounded two-detail warmup, one customer preload request across warm SPA
  navigation, full-frame cold skeletons, and page overflow at 390, 430, 1024, and 1440 px.
