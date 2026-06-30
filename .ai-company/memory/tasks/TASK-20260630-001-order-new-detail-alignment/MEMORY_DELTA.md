# Memory Delta

## Facts

- New order and order detail now share order-specific workspace primitives for section header, money strip, quote row, and empty block.
- The task used order detail as the visual source of truth.
- Desktop and mobile visual evidence was generated under `screenshots/order-new-detail-alignment-20260630/`.

## Risks

- The preview server is running in local E2E/business desktop mode to allow direct order-page access without login for visual verification.
- The worktree contains many unrelated dirty and untracked files from earlier work; stage only this task's files if committing.

## Reuse Guidance

- For future order UI alignment, prefer reusing `order-workspace-primitives.tsx` before introducing more local summary tiles or quote-row markup.
