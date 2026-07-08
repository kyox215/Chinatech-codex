# Memory Delta

## Candidates

- For RepairDesk order UX, show the main staff-facing order process as five phases: 接单, 检测报价, 维修处理, 通知取机, 收款完成.
- Preserve canonical `workflowStatus` values for APIs, transitions, guards, permissions, analytics, and historical compatibility; aggregate them only in UI-facing helpers.
- `diagnosis` plus `quote` should display as 检测报价; `parts` plus `repair` should display as 维修处理.
- Keep detailed canonical workflow filters available as a secondary/advanced control when the primary filter is simplified.
