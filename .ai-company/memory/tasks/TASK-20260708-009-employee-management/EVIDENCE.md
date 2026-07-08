# Evidence Index — TASK-20260708-009-employee-management

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | task | task contract created | `TASK.md` | observed | 2026-07-08T17:22:00Z | Codex |
| E-002 | sub-agent | Product/Data/Security/UX read-only reviews completed | subagent ids in `TASK.md` | observed | 2026-07-08T17:44:31Z | Codex |
| E-003 | test | repository member lifecycle and permission tests pass | `npx vitest run src/features/stores/server/store.repository.test.ts` | 1 file / 40 tests passed | 2026-07-08T17:36:59Z | Codex |
| E-004 | test | schema/router tests pass | `npx vitest run src/server/api/repairdesk-schemas.test.ts src/server/api/repairdesk-router.test.ts` | 2 files / 16 tests passed | 2026-07-08T17:37:50Z | Codex |
| E-005 | static | TypeScript passes | `npm run typecheck` | passed | 2026-07-08T17:39:00Z | Codex |
| E-006 | static | ESLint passes | `npm run lint` | passed | 2026-07-08T17:39:00Z | Codex |
| E-007 | test | full Vitest suite passes | `npm run test` | 80 files / 534 tests passed | 2026-07-08T17:39:56Z | Codex |
| E-008 | build | production build passes on webpack path | `npx next build --webpack` | passed | 2026-07-08T17:40:00Z | Codex |
| E-009 | visual | desktop Settings employee management renders | `screenshots/employee-management-settings-desktop.png` | observed | 2026-07-08T17:42:00Z | Codex |
| E-010 | visual | mobile Settings employee management renders full page | `screenshots/employee-management-settings-mobile-full.png` | observed | 2026-07-08T17:43:00Z | Codex |
| E-011 | production-log | Settings employee members endpoint failing as non-permission error | `vercel logs ... --status-code 4xx` | `GET /api/repairdesk/stores/members` returned 400 | 2026-07-08T18:00:00Z | Codex |
| E-012 | data-check | production store member base tables readable while invite-link table missing | read-only Supabase service-role table checks | `store_memberships` ok, `store_invitations` ok, `store_invite_links` returned PGRST205 schema-cache missing-table error | 2026-07-08T18:03:00Z | Codex |
| E-013 | sub-agent | DATA hotfix review completed | subagent `019f42e6-90d9-7d71-be77-a5caf81a3d9e` | confirmed missing-table root cause and narrow fallback suitability | 2026-07-08T18:08:00Z | Codex |
| E-014 | sub-agent | QA hotfix review completed | subagent `019f42e6-b904-7780-88ba-ab15cf6fa3f3` | requested positive and negative fallback tests before push | 2026-07-08T18:10:00Z | Codex |
| E-015 | test | missing invite-link table fallback and negative cases pass | `npx vitest run src/features/stores/server/store.repository.test.ts` | 1 file / 45 tests passed | 2026-07-08T18:11:15Z | Codex |
| E-016 | test | full Vitest suite passes after hotfix | `npm run test` | 80 files / 539 tests passed | 2026-07-08T18:11:29Z | Codex |
| E-017 | static | TypeScript and ESLint pass after hotfix | `npm run lint`; `npm run typecheck` | both passed; typecheck rerun after build completed | 2026-07-08T18:11:50Z | Codex |
| E-018 | build | production build passes after hotfix on webpack path | `npx next build --webpack` | passed | 2026-07-08T18:11:46Z | Codex |

## Environment notes

- `npm run build` failed in the temporary worktree because Turbopack rejects a `node_modules` symlink pointing outside the filesystem root. The same code passed `npx next build --webpack`.
- Playwright screenshots required elevated local execution because sandboxed Chromium launch was blocked by macOS Mach port permissions.
- The production hotfix does not apply the `store_invite_links` migration; invite-code create/redeem/revoke remains pending explicit Owner approval for production schema change.
