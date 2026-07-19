# Evidence Index

| ID    | Evidence                                             | Result                                                                                                                                            |
| ----- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| E-001 | User screenshot `1-照片-1.jpg`                       | Current mobile Sheet has textarea, 800-char counter and send button; no voice control.                                                            |
| E-002 | Root `git status --short --branch`                   | Root checkout is heavily dirty and diverged; isolated worktree required.                                                                          |
| E-003 | `git fetch --prune origin`; `origin/main@152caa1c`   | Fresh implementation base established.                                                                                                            |
| E-004 | WebKit “New WebKit Features in Safari 14.1”          | Safari speech recognition uses Siri engine; Siri/Dictation availability is required.                                                              |
| E-005 | W3C Web Speech API draft, security/privacy section   | Explicit informed click and obvious recording/stop indication are required; recognizer may be local or remote.                                    |
| E-006 | WebKit issue 225298                                  | Historical PWA/SafariViewController limitation requires runtime feature/error detection and keyboard fallback.                                    |
| E-007 | `TASK.md`, `PHASE_PLAN.md`, `PRD.md`, `APPROVALS.md` | R2/L2 local contract and separate D4 production boundary recorded before code write.                                                              |
| E-008 | Voice hook + AI Sheet integration                    | Explicit one-shot start/stop, fixed error mapping, 800-char merge, abort cleanup, unsupported fallback and manual-send-only behavior implemented. |
| E-009 | Focused Vitest at 2026-07-19T06:06:34Z               | `ai-assistant-sheet.test.tsx`: 11/11 passed, including no-auto-submit, denial, close-abort, unsupported and length boundary.                      |
| E-010 | `npm run typecheck` at 2026-07-19T06:06:34Z          | Passed after implementation and scoped formatting.                                                                                                |
| E-011 | `docs/AI_ASSISTANT_VOICE_INPUT.md`                   | Browser compatibility, privacy, zero-audio-storage/zero-transcription-cost and D4 release boundary documented.                                    |
| E-012 | Upstream sync                                        | Voice work was stashed, branch fast-forwarded to `origin/main@951fd626`, and restored without conflict before full gates.                         |
| E-013 | Node 22 full gates at 2026-07-19T06:13:05Z           | lint PASS; typecheck PASS; Vitest 305 files / 1,915 tests PASS; Next.js production build PASS.                                                    |
| E-014 | `SECURITY_REVIEW.md`                                 | Local candidate PASS; no audio access/storage/auto-submit; browser vendor processing remains production D4 residual risk.                         |
| E-015 | `DOCUMENTATION_SYNC.md`                              | Employee, developer, QA, privacy and release behavior synchronized; API/data unchanged.                                                           |
| E-016 | Full Playwright AI assistant spec                    | PASS — 7/7, including 390x844 and 430x932 full-width/no-overflow checks, no-auto-submit voice flow, permission and offline boundaries.            |
| E-017 | Focused voice Playwright rerun at 2026-07-19T06:25Z  | PASS — 1/1; transcript filled the composer, created no order result, retained manual Send, and produced the final task screenshot.                |
| E-018 | In-app browser at 390x844                            | PASS — 390px Sheet/document, no overflow, 16px textarea, accessible enabled mic, privacy and manual-send copy; no real mic activation.            |
| E-019 | Sanitized mobile screenshot                          | PASS — final 390px result has no development overlay or customer/production data.                                                                 |
| E-020 | Final Node 22 rerun after formatting                 | PASS — lint, typecheck and focused component regression 11/11.                                                                                    |
| E-021 | `git fetch --prune origin` at 2026-07-19T06:30Z      | PASS — candidate base and latest `origin/main` both `951fd62658dee318465dab0d70d66804f22ea353`; no upstream gap.                                  |
| E-022 | Final scoped diff/security review                    | PASS — only approved paths; `next-env.d.ts` restored; no package, lockfile, API, DB, environment, secret or production-config change.             |

## Remaining release evidence

- Production smoke/observation intentionally absent because production release is not approved in this task.
- `2026-07-19T06:29:08Z` `26387d4d2e` — Node 22 lint/typecheck/full Vitest/build passed; Playwright AI assistant 7/7 and focused voice 1/1 passed
- `2026-07-19T06:29:08Z` `cb5da9f634` — 390x844 browser check passed with no overflow, 16px textarea, privacy/manual-send copy, and sanitized screenshot
- `2026-07-19T06:32:03Z` `1b3af5b32e` — Latest origin/main equals base 951fd626; final path allowlist, diff check, secret/audio boundary, lint, typecheck, focused test and screenshot passed
