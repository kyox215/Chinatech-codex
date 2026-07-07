# Memory Delta — TASK-20260707-005

## Candidate reusable rule

RepairOS list and management pages must not render a page-body module title block duplicating the AppBar, such as `工作台 / 客户`, `客户管理`, or `全部 · 共 ...`. The shared `RepairOsListScaffold` should keep actions and header add-ons but not default-render `eyebrow/title/subtitle` on desktop.
