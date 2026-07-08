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

## Environment notes

- `npm run build` failed in the temporary worktree because Turbopack rejects a `node_modules` symlink pointing outside the filesystem root. The same code passed `npx next build --webpack`.
- Playwright screenshots required elevated local execution because sandboxed Chromium launch was blocked by macOS Mach port permissions.
