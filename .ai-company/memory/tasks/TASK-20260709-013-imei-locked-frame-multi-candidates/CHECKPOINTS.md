# Checkpoints

## 2026-07-09 - Task start

- Created isolated branch `codex/imei-multi-candidate-lock` from latest `origin/main`.
- Root cause from current code: `handleCameraDecodeResult` returns immediately when the first ZXing raw value parses as a candidate, so locked-frame multi-barcode/OCR enrichment is skipped.
- External inspiration from prior research: keep ZXing for fast camera trigger; use locked-frame multi-source recognition and candidate merge rather than replacing the scanner library in this task.
- Next: implement locked-frame enrichment, candidate merge ordering, focused regression tests, and visual smoke evidence.

## 2026-07-09T11:15:16Z - Implementation checkpoint

- Implemented locked-frame enrichment in `src/components/imei-scanner-field.tsx`.
- Live camera scan now freezes the frame first, then collects candidates from the first ZXing value, locked-frame multi-barcode detection, single-image barcode fallback, and OCR when fewer than two valid IMEI values are present.
- Candidate merge now deduplicates by value, prefers valid IMEI over suspect IMEI over serial, and keeps barcode boxes when available for overlays.
- Updated status copy to `已锁定画面，正在识别更多编号...`.
- Updated focused component test to reproduce the owner screenshot pattern: first raw scan is a long serial, locked frame OCR returns IMEI1/IMEI2, and the UI lists IMEI values before the serial.
- Validation passed: focused component test, typecheck, lint, full Vitest, build outside sandbox, and IMEI Playwright smoke.
- Visual evidence copied into `screenshots/TASK-20260709-013-imei-locked-frame-multi-candidates/`.
- Next: final diff check, close task memory, commit, fetch/push check, push to `main`.

## 2026-07-09T11:16:13Z - Ready for rebase and push

- Final diff check passed with no whitespace errors.
- `origin/main` advanced by one supplier-management commit after this worktree was created.
- Task memory is closed before commit; next step is to commit, rebase onto latest `origin/main`, rerun focused validation if conflict resolution changes code, then push.

## 2026-07-09T11:20:10Z - Post-rebase validation

- Rebased the IMEI commit onto `origin/main` after supplier-management commit `d75c741a`.
- Resolved the only conflict in `.ai-company/memory/ACTIVE_CONTEXT.md` by preserving supplier-management caveat and marking this IMEI task as latest completed.
- Re-ran focused component test, typecheck, lint, full Vitest, build outside sandbox, and IMEI Playwright smoke; all passed.
- Refreshed visual evidence screenshots and restored generated changes outside this task scope.
