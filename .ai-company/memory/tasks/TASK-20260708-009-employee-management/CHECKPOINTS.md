# Checkpoints — TASK-20260708-009-employee-management

## 2026-07-08T17:22:00Z — Task started with real sub-agents

- **Phase:** implementing
- **Completed/current state:** Owner set goal and requested sub-agents. Goal created. Spawned read-only Product, Data, Security, and UX reviewer sub-agents. Created isolated worktree `/tmp/repairdesk-employee-management` on branch `codex/employee-management` from `origin/main`.
- **Decision:** Main thread remains the only business-code writer; reviewers are read-only to avoid write conflicts.
- **Risk:** Employee management touches authorization, tenant isolation, and account lifecycle; no production migration or deploy without separate owner approval.
- **Next:** Implement server member lifecycle APIs and Settings UI improvements in the isolated worktree.
- **Recorded by:** Codex

## 2026-07-08T17:44:31Z — Implementation validated

- **Phase:** validated-local
- **Completed/current state:** Added member lifecycle API contracts, schemas, client calls, router routes, service exports, repository functions, Settings employee-management UI, mock-source support, and focused tests.
- **Security/data decisions:** `stores/members` now requires `member:manage_basic`; new role/status APIs only accept membership id plus non-owner role/status action; target membership is read/updated with active `store_id`; owner rows are blocked; self role edit and self disable are blocked; manager cannot grant/manage manager; audit before/after snapshots omit email/display name.
- **UI decisions:** Settings section renamed to `员工管理`; owner-only join-request review can choose final role; owner/manager invite/code roles are restricted by actor role; employee list has search, status filter, counts, status badges, per-row role draft/save, disable/restore, empty/error/loading states.
- **Verification:** `npx vitest run src/features/stores/server/store.repository.test.ts` passed 40 tests; `npx vitest run src/server/api/repairdesk-schemas.test.ts src/server/api/repairdesk-router.test.ts` passed 16 tests; `npm run typecheck` passed; `npm run lint` passed; `npm run test` passed 80 files / 534 tests; `npx next build --webpack` passed. Plain `npm run build` failed because Turbopack rejects the temporary worktree `node_modules` symlink pointing outside project root.
- **Visual evidence:** `/tmp/repairdesk-employee-management/screenshots/employee-management-settings-desktop.png`, `/tmp/repairdesk-employee-management/screenshots/employee-management-settings-mobile-full.png`.
- **Next:** Commit scoped files from isolated worktree and push `HEAD:main` if owner push request remains active.
- **Recorded by:** Codex

## 2026-07-08T18:12:44Z — Production Settings employee read hotfix validated

- **Phase:** hotfix-validated-pending-push
- **Incident symptom:** Owner reported production `/settings` shows `无法读取员工管理` while logged in as `kyox120@gmail.com`.
- **Root cause evidence:** Vercel 4xx logs showed `GET /api/repairdesk/stores/members` returning `400`, not `403`. Read-only Supabase checks showed `store_memberships` and `store_invitations` readable, while `public.store_invite_links` returned `PGRST205` schema-cache missing-table error.
- **Decision:** Ship a narrow code compatibility hotfix for member listing only: missing `store_invite_links` with `PGRST205` and schema-cache wording returns `invite_links: []`; all member, invitation, permission, and other invite-link errors still fail normally.
- **Sub-agent review:** DATA reviewer `019f42e6-90d9-7d71-be77-a5caf81a3d9e` confirmed the root-cause hypothesis and compatibility behavior. QA reviewer `019f42e6-b904-7780-88ba-ab15cf6fa3f3` requested positive and negative fallback coverage before push; those tests were added.
- **Files changed:** `src/features/stores/server/store.repository.ts`, `src/features/stores/server/store.repository.test.ts`.
- **Verification:** `npx vitest run src/features/stores/server/store.repository.test.ts` passed 45 tests; `npm run test` passed 80 files / 539 tests; `npm run lint` passed; `npm run typecheck` passed after build completed; `npx next build --webpack` passed. One parallel `npm run typecheck` attempt failed because concurrent build refreshed `.next/types`; rerun after build passed.
- **Open approval point:** Production database migration `supabase/migrations/20260704221944_store_invite_links.sql` is still required to restore invite-code create/redeem/revoke behavior. It must not be applied without explicit Owner approval and production schema verification.
- **Next:** Commit scoped hotfix and checkpoint, rebase onto latest `origin/main` (`60b0704`), push `HEAD:main`, then confirm Vercel deploy/alias status.
- **Recorded by:** Codex
