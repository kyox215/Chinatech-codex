# Evidence Index — TASK-20260619-012

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-06-19T20:29:42Z | Integration Lead / CEO Agent |
| E-002 | governance | L2 cleanup boundary and project authority were loaded | `AGENTS.md`; `.ai-company/REPAIRDESK_ADOPTION.md`; `.ai-company/policies/*`; `AI智能部门管理/部门化管理设计.md`; relevant `.agents/skills/*/SKILL.md` | observed; scoped cleanup only | 2026-06-19T20:31:14Z | Integration Lead / CEO Agent |
| E-003 | scan | deletion-scope untracked ` 2` file scan identified byte-identical and now-different duplicates | SHA-256 scan over untracked paths containing ` 2` in the cleanup scope | pre-cleanup: `same=70 diff=2 missing=0 nonfiles=0` | 2026-06-19T20:31:14Z | Integration Lead / CEO Agent |
| E-004 | preflight | initial duplicate inventory is not assumed current | `TASK-20260619-004/DUPLICATE_WORKTREE_INVENTORY.md`; fresh scan | historical 72 same differs from current 70 same because cleanup wave changed worktree | 2026-06-19T20:31:14Z | Integration Lead / CEO Agent |
| E-005 | change | exactly the 70 verified byte-identical duplicate files were deleted | `apply_patch` delete hunks for the 70 paths listed in `BYTE_IDENTICAL_CLEANUP_REPORT.md` | success; no now-different duplicates or canonical files included | 2026-06-19T20:31:14Z | Integration Lead / CEO Agent |
| E-006 | postflight | byte-identical duplicate file count is now zero in the deletion-scope scan | repeat SHA-256 scan over untracked ` 2` paths in cleanup scope | post-cleanup: `same=0 diff=2 missing=0 nonfiles=0` | 2026-06-19T20:31:14Z | Integration Lead / CEO Agent |
| E-007 | boundary | excluded now-different duplicates remain untouched in the original cleanup scope | repeat SHA-256 scan | remaining diff files: `src/features/orders/components/warranty-picker 2.tsx`; `src/server/tenant-guard.test 2.ts` | 2026-06-19T20:31:14Z | Integration Lead / CEO Agent |
| E-008 | validation | governance checks pass after cleanup | `npm run agents:check` | passed: Agent config, template, and rule checks passed | 2026-06-19T20:31:14Z | Integration Lead / CEO Agent |
| E-009 | closeout scan | final Git-visible scan confirms zero byte-identical duplicates and identifies all now-different residuals | SHA-256 scan over `git ls-files --others --exclude-standard -z` paths containing ` 2` | final: `same=0 diff=3 missing=0 nonfiles=0`; diff paths: `.ai-company/README 2.md`, `src/features/orders/components/warranty-picker 2.tsx`, `src/server/tenant-guard.test 2.ts` | 2026-06-19T20:39:01Z | Integration Lead / CEO Agent |
| E-010 | validation | governance checks pass after memory updates | `npm run agents:check` | passed: Agent config, template, and rule checks passed | 2026-06-19T20:39:01Z | Integration Lead / CEO Agent |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
