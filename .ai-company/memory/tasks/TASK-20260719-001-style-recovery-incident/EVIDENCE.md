# Evidence

## Initial evidence

- Owner screenshot: `/tmp/codex-remote-attachments/019f763a-4f63-7d40-bf84-4fdef9751016/6B62C46A-B9E5-4A2D-BED7-7DE0C116D2F2/1-照片-1.jpg`.
- Public HTML check: HTTP 200 with the current fallback/guard identifiers and fallback copy.
- Browser state at 390x844: marker `1`, fallback exists and is hidden, shell exists and is `display:contents`, critical guard exists; fallback and shell inline style attributes are both absent.

## Validation

### Reproduction

- Added `keeps raw markup hidden when the complete author style layer disappears`.
- Before the fix: FAIL because `#repairdesk-styled-shell` was visible after every `link[rel=stylesheet]` and `style` node was removed.
- Failure screenshot: generated Playwright artifact showed the recovery text followed by raw RepairDesk login DOM.

### Implementation

- `src/app/layout.tsx`: fallback overlay, content, spinner and application shell now have static inline presentation.
- Normal global CSS still hides the fallback and reveals the shell through the existing `!important` rules.
- No Service Worker, API, auth, data, migration or unrelated feature behavior changed.

### Local gates

- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm run test`: PASS, 305 files / 1915 tests.
- `npm run build`: PASS, Next.js 16.2.6, 26 routes generated.
- Chromium style recovery E2E: PASS, 4/4.
- WebKit style recovery E2E: PASS, 4/4.
- `git diff --check`: PASS.

### Visual evidence

- `screenshots/TASK-20260719-001-style-recovery-incident/mobile-complete-style-loss-protected.png`: 390x844, every author stylesheet node removed, only the fixed recovery overlay visible.

### Release evidence

Pending.
