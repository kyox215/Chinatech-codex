# Evidence Index — TASK-20260619-014

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-06-19T20:46:20Z | Integration Lead / CEO Agent |
| E-002 | review package | three target files are delete-only candidates | `TASK-20260619-013/REMAINING_DIFFERING_DUPLICATES_REVIEW.md` | all three classified as delete-only candidates | 2026-06-19T20:47:10Z | Integration Lead / CEO Agent |
| E-003 | pre-delete path check | all three target duplicate files and canonical counterparts exist before deletion | Python path/hash/line-count check over the three pairs | all pairs `ok`; all pairs `same=False`; duplicate/canonical line counts recorded | 2026-06-19T20:47:10Z | Integration Lead / CEO Agent |
| E-004 | change | exactly the three reviewed duplicate files were deleted | `apply_patch` delete hunks for `.ai-company/README 2.md`, `warranty-picker 2.tsx`, `tenant-guard.test 2.ts` | success | 2026-06-19T20:47:10Z | Integration Lead / CEO Agent |
| E-005 | post-cleanup scan | no Git-visible untracked ` 2` duplicate files with canonical counterparts remain | SHA-256 scan over `git ls-files --others --exclude-standard -z` paths containing ` 2` | `same=0 diff=0 missing=0 nonfiles=0` | 2026-06-19T20:47:10Z | Integration Lead / CEO Agent |
| E-006 | validation | governance checks pass after cleanup | `npm run agents:check` | passed: Agent config, template, and rule checks passed | 2026-06-19T20:47:10Z | Integration Lead / CEO Agent |
| E-007 | boundary | canonical counterparts were not cleaned or reverted by this task | `git status --short -- .ai-company/README\ 2.md ... src/server/tenant-guard.test.ts` | deleted duplicate paths absent; canonical statuses remain pre-existing (`.ai-company/README.md` untracked; two canonical files modified) | 2026-06-19T20:47:10Z | Integration Lead / CEO Agent |
| E-008 | final validation | governance checks and duplicate scan pass after memory updates | `npm run agents:check`; final SHA-256 scan over Git-visible untracked ` 2` files | agents check passed; `same=0 diff=0 missing=0 nonfiles=0` | 2026-06-19T20:49:17Z | Integration Lead / CEO Agent |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
