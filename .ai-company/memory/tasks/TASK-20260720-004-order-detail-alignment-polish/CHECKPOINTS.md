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

## 2026-07-20 — Released and production verified

- Pushed task branch `codex/order-detail-alignment-20260720` and fast-forwarded `main` to `8dc70c7ccd87a8bde77ff113f334e288068b771b`.
- Exact Vercel production deployment `dpl_G4X3EwapfxHPdkcnhyHEsbCt1oDK` reached `READY`; aliases include `chinatech.in` and `www.chinatech.in`.
- Vercel reported no `/orders` runtime error clusters in the 15-minute observation window.
- Authenticated Chrome smoke on `https://www.chinatech.in/orders` was read-only and restored to the order list after verification.
- Production geometry: dialog root `998px`, no page horizontal overflow, no dialog overflow, overview card top/bottom spread `0px`, responsibility-card width/top/bottom spread `0px`, and record-section left/right spread `0px`.
- The three-entry production timeline fit without extra dialog scrolling; browser console warnings/errors were `0`.
- Task closed with no API, database, permission, payment, workflow, or mobile changes.
- Final memory checkpoint updated `.ai-company/memory/ACTIVE_CONTEXT.md` only after a fresh `origin/main` check confirmed it still referenced an already-completed V4 task; no active concurrent task context was overwritten.
- Resume action: none unless the Owner reports a production layout edge case; reopen from this task directory and stop if reproduction would require production writes or customer-data export.
