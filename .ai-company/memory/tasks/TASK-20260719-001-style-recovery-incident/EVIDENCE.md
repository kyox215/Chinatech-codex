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
- `screenshots/TASK-20260719-001-style-recovery-incident/production-mobile-normal-362e4c3d.png`: real production Orders page at 390x844 after deployment; normal styled shell visible and fallback hidden.
- `screenshots/TASK-20260719-001-style-recovery-incident/production-desktop-normal-362e4c3d.png`: real production Orders page at 1440x900 after deployment; normal styled shell visible and fallback hidden.

### Release evidence

- Git commit: `362e4c3d7624793718fa65b7c96d84fac481c61d`, fast-forwarded to `main` from `635b7288b9dbdc83171a28818e8ce2bd4094aee5`.
- Vercel: deployment `dpl_3A6RVWswPoUgJueqmYiqJq1jHWRR`, URL `chinatech-codex-9egm8h10f-kyox120-9295s-projects.vercel.app`, target production, state `READY`.
- Alias proof: `www.chinatech.in` and `chinatech.in` both point to that deployment.
- Runtime HTML: HTTP 200; `repairdesk-critical-style-guard` exists; fallback has `position:fixed`, maximum z-index and grid layout inline; shell has inline `display:none`.
- Production Chromium: PASS 4/4.
- Production WebKit: PASS 4/4.

### Documentation and memory review

- Updated: task, incident, checkpoint, evidence and closeout records in this task archive.
- Not applicable: public API, schema, migration, configuration and operating runbooks are unchanged.
- Not promoted: one incident does not justify a global policy, department-memory change or capability/autonomy upgrade.
- `ACTIVE_CONTEXT.md` intentionally remains owned by the concurrent R4 AI inventory release and was not overwritten.
