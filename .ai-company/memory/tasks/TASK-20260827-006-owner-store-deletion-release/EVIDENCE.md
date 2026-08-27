# Evidence Index — TASK-20260827-006-owner-store-deletion-release

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-08-27T18:31:22Z | Hexiang Huang / Owner |
| E-002 | control-plane | worker/window/WP identity and immutable context were verified without taking integration ownership | Registry doctor/status; context packet SHA `bef21d7e520844be1af0788ed88e9ee28976cc80dfc5178a3930a0b1e42030d2`; integration lease was held by `WINDOW-01A03AC9-ACCOUNT-REPAIR-INTEGRATION-V2` during rehydration | observed; this worker did not acquire the lease | 2026-08-27T18:37:35Z | luna_worker |
| E-003 | baseline | candidate baseline is the latest fetched origin main | `git fetch --no-tags origin main`; `git rev-parse origin/main` and candidate HEAD | `e80099b2c36e89a484acf4430f3fddb4a9f199ad` on both checks; no rebase required | 2026-08-27T18:53:55Z | luna_worker |
| E-004 | isolation | release-candidate worktree is isolated and uncommitted | `/private/tmp/repairdesk-store-delete-release-20260827`; branch `codex/store-delete-release-20260827`; `git status --short` | HEAD is the exact E-003 SHA; only scoped candidate files are modified/untracked; no commit/push/deploy | 2026-08-27T18:53:55Z | luna_worker |
| E-005 | scope | TASK-005 deletion feature was reconstructed without copying account-registration or unrelated shared-root hunks | manual `rg`/diff selection from shared root; candidate `git status --short` manifest and `git diff --check` | 27 scoped application/test/runbook files; the five additional files are the same-directory `store-purge-*` architecture split; diff check PASS | 2026-08-27T19:34:44Z | luna_worker |
| E-006 | targeted-test | lifecycle candidate behavior is covered by the requested targeted suite | Node24 `node node_modules/vitest/vitest.mjs run` with the 13 lifecycle files | PASS — 13 test files, 79 tests, exit 0 | 2026-08-27T19:34:44Z | luna_worker |
| E-007 | lint | scoped candidate files satisfy ESLint/Prettier rules | Node24 direct ESLint on all 27 changed application/test/spec files | PASS, exit 0 | 2026-08-27T19:34:44Z | luna_worker |
| E-008 | typecheck | clean dependency install removed the earlier baseline typecheck blocker | Node24-driven `npm run typecheck` via npm CLI 10.8.2 | PASS, exit 0 | 2026-08-27T19:34:44Z | luna_worker |
| E-009 | full-test | full Vitest regression was completed after clean dependency installation | Node24 `node node_modules/vitest/vitest.mjs run` | PASS — 460 test files, 3048 tests, exit 0; only a pre-existing jsdom navigation message was emitted | 2026-08-27T19:34:44Z | luna_worker |
| E-010 | build | production build gate reached the remaining environment-only blocker | Node24-driven `npm run build` via npm CLI 10.8.2 | FAIL environment-only: Inter, JetBrains Mono, and Space Grotesk Google Font fetches are unavailable offline; `html2canvas`/`pdf-lib` resolved after clean install | 2026-08-27T19:34:44Z | luna_worker |
| E-011 | safety | no production/destructive action was performed | command audit and task constraints | no Supabase access, migration, env edit, worker enablement, Storage/DB deletion, commit, push, deploy, or integration-lease takeover | 2026-08-27T18:53:55Z | luna_worker |
| E-012 | dependencies | clean dependency verification is reproducible from the lockfile | Node24 `node .../npm/bin/npm-cli.js ci --include=optional`; package manifest SHA before/after | PASS — npm 10.8.2 added 730 packages; `package.json` and `package-lock.json` hashes stayed unchanged and no manifest status appeared | 2026-08-27T19:34:44Z | luna_worker |
| E-013 | architecture | the 776-line manager was split into bounded coordinator/presentational/logic modules without API or state-machine changes | candidate source line counts and manager behavior tests | PASS — coordinator 28 lines; confirmation surface 224; status card 185; state 405; pure logic 89; split logic test 64 | 2026-08-27T19:34:44Z | luna_worker |
| E-014 | release-review | independent release review assessed the exact-SHA candidate and production safety posture | independent release reviewer report | Preview exact-SHA GO; production flags-off GO; real permanent purge NO-GO | 2026-08-27T19:34:44Z | independent release reviewer |
| E-015 | flags | deletion-related production/Preview flags remain disabled | independent release reviewer flag scan | six relevant flags are absent or not equal to `1`; no flag was changed by this worker | 2026-08-27T19:34:44Z | independent release reviewer |
| E-016 | approval | Owner approval boundary for later release work is explicit | Owner instruction relayed by Integration Lead | scoped commit/push/deploy authorized for the qualified integration/release window; migration, flag changes, and real deletion remain unauthorized | 2026-08-27T19:34:44Z | Hexiang Huang / Owner |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.

## Candidate changed-file manifest

The isolated candidate contains only these 27 tracked/untracked scoped files:

```text
docs/STORE_LIFECYCLE_IMPLEMENTATION_RUNBOOK.md
src/entities/store/model/store-purge-confirmation.ts
src/entities/store/model/store-purge-confirmation.test.ts
src/features/settings/screens/closed-stores-screen.tsx
src/features/settings/sections/store-delete-entry.tsx
src/features/settings/sections/store-delete-entry.test.tsx
src/features/settings/sections/store-purge-confirmation-surface.tsx
src/features/settings/sections/store-purge-manager-logic.test.ts
src/features/settings/sections/store-purge-manager-logic.ts
src/features/settings/sections/store-purge-manager-state.ts
src/features/settings/sections/store-purge-manager.tsx
src/features/settings/sections/store-purge-manager.test.tsx
src/features/settings/sections/store-purge-status-card.tsx
src/features/settings/sections/store-settings-section.tsx
src/features/settings/sections/store-settings-section.test.tsx
src/features/stores/server/store-lifecycle.repository.ts
src/features/stores/server/store-lifecycle.repository.test.ts
src/features/stores/server/store-purge-supabase-adapter.ts
src/features/stores/server/store-purge-supabase-adapter.test.ts
src/features/stores/testing/mock-api.ts
src/features/stores/testing/mock-api.test.ts
src/lib/repairdesk/types.ts
src/server/api/repairdesk-router.ts
src/server/api/repairdesk-schemas.ts
src/server/api/store-purge-schemas.test.ts
src/server/api/store-purge-route.test.ts
tests/e2e/store-lifecycle-settings.spec.ts
```

Rollback candidate: discard the uncommitted isolated worktree and return to
`origin/main@e80099b2c36e89a484acf4430f3fddb4a9f199ad`; the shared root was not
rewound or cleaned.
