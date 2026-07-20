# Checkpoints

## 2026-07-20 — Intake and isolated baseline

- Owner screenshot verified: the records workspace uses three unrelated horizontal boundaries.
- Root worktree is heavily dirty and local `main` is divergent; no root files will be edited.
- Created isolated branch `codex/order-detail-alignment-20260720` from `origin/main` at `471a2b45df6c0664b29ceea786cedb659ffcd624`.
- Scope is desktop order-detail presentation and layout tests only.
- No sub-agent spawned: one cohesive UI/test ownership area and no explicit delegation request.

## 2026-07-20 — Verified before release

- Rebased implementation commit onto current `origin/main`; current task commit is `8b828054417e4121e0a4e88b8488258a36ccf560`.
- Records controls now use the full `920px` readable boundary with two equal columns; both cards share the same compact panel structure and baseline.
- Overview customer/device/finance cards share top and bottom grid lines without increasing the row height.
- Key information uses a two-column dialog grid; record category panels share the same left/right boundary.
- `npm run agents:check`, full lint, full typecheck, 319 Vitest files / 2102 tests, and production webpack build passed.
- Playwright layout-only matrix passed at 1024, 1280, 1440, 1536, and 1600 pixels; screenshots are stored under the task screenshot directory.
- A first sandbox browser start failed with `listen EPERM`; elevated localhost preview resolved it. A Turbopack symlink restriction was avoided with the supported webpack dev mode. These were environment/tooling issues, not product failures.
- A sandboxed build could not reach Google Fonts; the same build passed with approved network access.
- Next action: release, observe, production smoke, then close.
- Global `ACTIVE_CONTEXT.md` was intentionally not replaced because it belongs to the concurrently active customer workbench task.
