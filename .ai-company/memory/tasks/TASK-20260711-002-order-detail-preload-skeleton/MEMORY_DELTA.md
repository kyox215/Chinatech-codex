# Memory Delta

- Order-detail automatic preload has one owner: the mounted order list. App-level preload warms workspaces only.
- Detail automatic budget is at most two current visible orders on normal networks, one on 3G and zero on Save-Data/2G/offline; concurrency is one and queued work is bounded.
- The latest queued user intent replaces an older queued intent; pointer leave and focus-out cancel work that has not started.
- Screens, Dialogs and preload must share the same store-scoped detail query options and `orders.all` freshness group.
- Store-shell loading and terminal states must be distinguished; terminal error recovery retries shell queries in place.
- These verified contracts are documented in `docs/REALTIME_PRELOAD_COORDINATION.md`; no additional department policy or capability-level promotion is warranted from this single task.
