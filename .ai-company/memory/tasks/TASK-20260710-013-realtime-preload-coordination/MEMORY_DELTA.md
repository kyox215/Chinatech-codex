# Memory Delta

- Screens and intelligent preload must consume the same feature query-option factory; never create a second business cache or duplicate unscoped startup request.
- Realtime invalidation, manual refresh, reconnect catch-up, optimistic rollback, and store switching must coordinate through query-group and store epochs.
- Realtime events remain metadata-only; authorized API refetch remains the source of business data.
- Production Realtime flags stay off until private-channel RLS, Dashboard public-access settings, and the Database Application Gate are separately approved and verified.
