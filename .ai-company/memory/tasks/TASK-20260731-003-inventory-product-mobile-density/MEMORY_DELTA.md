# Memory Delta — TASK-20260731-003

## Promoted

- Product inventory mobile standard: 84–88px list cards, five 44px category controls, 16px mobile inputs, three-column compact detail workbench and fixed dual actions.
- Shared `surfaces.stickyActions` includes breakpoint negative margins; product-owned fixed/sticky bars must override both base and `sm` margins (`mx-0 sm:mx-0`) and verify container `scrollWidth` at desktop widths.
- Parallel-worktree Playwright runs must use a task-owned port and `PLAYWRIGHT_REUSE_EXISTING_SERVER=0`; inventory API regressions also require the controlled business test identity plus the exact Canary allowlist.
- Placeholder list data may persist only within the same exact store query scope; tenant changes must return no placeholder.

## Not promoted

- One-off merge SHA, temporary ports and failed first-run logs remain task evidence only.
- The WebKit mock hydration warning remains observed pre-existing debt, not a new approved standard.

## Conflicts

None. The earlier instruction to avoid the unpublished sitewide branch was superseded when that branch became the authoritative published `main`; the final merge preserved both releases.
