# Evidence

## Baseline and scope

- Isolated worktree: `/private/tmp/repairdesk-desktop-novice-ui-20260717`.
- Branch: `codex/desktop-novice-ui-20260717`.
- Baseline and pre-release remote head: `origin/main@91a5d077b04b8e7cb00277e40b24a21df31a2878` after fresh `git fetch --prune origin`.
- The original dirty checkout and all unrelated changes were preserved.
- `git diff --name-only origin/main -- supabase/migrations` is empty.

## Implemented behavior

- Unified the user-facing order term as “维修工单” and filtered navigation/command shortcuts by store permission and role.
- Simplified the queue around current task/next step; supplier and responsibility editing stays in order detail instead of list rows.
- New order starts with no custody default, reports exact missing fields, and focuses the selected missing control.
- Custody changes preserve the current password/PIN/pattern; ordinary offline drafts persist only a re-entry marker, never the raw secret.
- Order detail promotes at most one workflow-derived action and does not promote notification for cancelled/void/settled terminal states or invalid phone data.
- Approval WhatsApp uses open-then-confirm instead of recording sent state when the external window opens.
- Dashboard shows at most five priority cards; customer table removes duplicate finance columns; buyback load errors cannot masquerade as an empty dataset.

## Automated verification

- `npm run agents:check`: PASS.
- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm run test`: PASS, 213 files / 1467 tests.
- `npm run build`: PASS, optimized Next.js production build and 22 generated static pages.
- Desktop overflow/dialog matrix: 53 checks passed at 1024, 1280, 1440 and 1600 px.
- Order desktop audit: 5/5 passed at 1024, 1280, 1440, 1536 and 1600 px.
- Custody plus visual evidence suite: 4/4 passed, including explicit custody choice, `with_shop -> with_customer -> with_shop` PIN retention, cancelled-customer-held behavior, and final-page readiness before screenshots.
- Independent final read-only release re-audit: GO; no remaining blocker or unintended migration.

## Visual evidence

Controlled mock data only; no production credentials or customer PII.

- `screenshots/TASK-20260717-008-desktop-novice-ui-implementation/dashboard-1024x768.png`
- `screenshots/TASK-20260717-008-desktop-novice-ui-implementation/orders-1280x800.png`
- `screenshots/TASK-20260717-008-desktop-novice-ui-implementation/order-new-1440x900.png`
- `screenshots/TASK-20260717-008-desktop-novice-ui-implementation/order-detail-1440x900.png`
- `screenshots/TASK-20260717-008-desktop-novice-ui-implementation/order-detail-responsibility-1440x900.png`
- `screenshots/TASK-20260717-008-desktop-novice-ui-implementation/customers-1600x1000.png`
- `screenshots/TASK-20260717-008-desktop-novice-ui-implementation/buyback-error-1440x900.png`

## Supabase evidence

- CLI: `2.101.0`.
- Fresh `supabase migration list --linked` shows identical local/remote history through `20260717213518`.
- Required custody password-retention migration `20260717182220` is already present locally and remotely.
- Fresh `supabase db push --linked --dry-run` result: `Remote database is up to date.`
- Therefore the correct apply result is a verified no-op: zero pending task migrations, zero DDL/data writes, no `--include-all`, and no dummy migration.

## Documentation impact matrix

| Reader | Impact | Authoritative update | Verification |
|---|---|---|---|
| Store staff | Simpler desktop queue, exact missing fields, one recommended action | UI copy/tests/screenshots in this task | Playwright matrices and visual review |
| Support/QA | New terminal-action, permission, custody, error/empty and screenshot readiness regressions | Task EVIDENCE/CHECKPOINTS plus E2E specs | Full gates and independent GO review |
| Data/Release | No schema change; linked custody-retention migration already applied | Task Supabase evidence and Data memory | Linked list plus dry-run |
| Security | Custody does not clear credentials; raw secrets remain excluded from ordinary offline drafts and audit/event payloads | Active `docs/ORDERS_SPEC.md`, project/security memory | Unit/E2E tests and existing migration contract |

No README, API route, environment variable, dependency or new schema documentation is required for this UI release.

## Review team

- `/root/desktop_flow_data_audit`: read-only FLOW/DATA/SEC review; found WhatsApp confirmation and custody/secret invariants; confirmed zero migration.
- `/root/desktop_qa_release_gate`: read-only QA/release review; found terminal action, command permission, focus, secret-marker and screenshot-readiness gaps.
- `/root/desktop_release_reaudit`: read-only final release re-audit; verified all findings fixed and returned GO.

## Rollback

- Application rollback: revert the scoped release commit; do not roll back or delete `20260717182220`.
- Database rollback: not applicable because this task performs no database write.
- If a UI regression appears, keep the existing migration history intact and apply a forward UI fix.
