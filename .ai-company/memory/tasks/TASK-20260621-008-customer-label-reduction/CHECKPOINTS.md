# Checkpoints

## 2026-06-21T15:27:00+02:00 Verified

- Implemented customer tag display reduction according to owner-approved plan.
- Prioritized tags as: `需联系`, `价格敏感`, `VIP`, `企业`, `复购`, then other tags.
- Retained customer filter and tag dialog behavior.
- Verified with typecheck, lint, customer tests, full tests, production build, and screenshots.

Next suggested action: if the owner asks to push, stage only this task's customer UI files, screenshot evidence, and task memory, separately from unrelated dirty workspace changes.

## 2026-06-21T15:35:00+02:00 Fixed Tag Slot Verified

- Customer rows now reserve a fixed `5.5rem` right-side tag slot in the customer meta line, so tag position no longer shifts with field length.
- Mobile customer cards now use a name-first grid; on very narrow screens tags can move below the name instead of covering it.
- Added targeted `data-ui` markers for customer row/mobile names and tag slots to support layout assertions.
- Verified with typecheck, lint, focused customer Vitest, full Vitest, non-sandbox production build, and Playwright DOM/screenshot checks.

Next suggested action: if the owner asks to push, stage only this task's customer UI files, screenshot evidence, and task memory, separately from unrelated dirty workspace changes.
