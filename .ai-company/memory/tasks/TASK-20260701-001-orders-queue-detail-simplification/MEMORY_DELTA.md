# Memory Delta

## Candidates

- For RepairDesk order queue work, keep the desktop list task-first: stage/next action should lead the row, while customer, device, amount, and owner stay as compressed scan columns.
- For desktop order detail, prefer one scrollable workspace with inline records over tabs when the owner asks for one-page scanning.
- For Playwright checks on RepairDesk business pages, avoid `networkidle` as the primary ready signal because React Query/background requests can remain active; wait for route-specific business markers and data-test attributes instead.
