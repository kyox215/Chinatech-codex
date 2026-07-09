# TASK-20260709-021 Independent Store Project Declaration

Status: closed
Owner: Hexiang Huang / 鹤祥
Executor: Integration Lead / CEO Agent
Created: 2026-07-09T21:09:17Z
Risk: R1 low
Autonomy: L2 controlled execution

## Owner Goal

Write the owner-approved relationship rule into the project declaration:

- The platform is not a headquarters.
- Stores are not platform branches.
- The platform only provides system service.
- Stores are independent operating entities / private tenants.

## Business Value

Future planning, implementation, permissions, support access, and tenant isolation work must use the independent-store model instead of a headquarters/branch mental model.

## Scope

- Update the canonical project charter.
- Update the canonical independent partner store platform plan.
- Keep the change documentation-only.
- Push the scoped documentation change to `main` after validation.

## Out Of Scope

- Runtime authorization changes.
- Database migrations.
- Supabase production changes.
- UI changes or screenshots.
- Editing historical duplicate ` 2.md` document copies.

## Risk And Approval

- Documentation-only rule update: R1, safe under L2.
- No production database operation is needed or allowed for this slice.
- Push to `main` is owner-requested earlier in the thread and remains limited to this scoped documentation change.

## Agent Plan

Single-agent execution.

No spawned sub-agents because the owner request is a single, low-risk documentation write with two known canonical files; real sub-agent startup would add coordination cost without improving safety.

Departments considered / not spawned:

- DOC/RULES: main thread executed.
- SECURITY/PRIVACY: main thread checked wording for tenant-isolation meaning.

## Acceptance Criteria

- `docs/project-charter.md` contains the platform/store relationship declaration.
- `docs/INDEPENDENT_PARTNER_STORE_PLATFORM_PLAN.md` contains the same durable product rule.
- The change states that platform roles do not receive default store business-data access.
- No database migration is created.
- Validation evidence is recorded.

## Result

- Documentation updates are complete and validated.
- No database migration was needed for this documentation-only owner directive.
- Release completed: commit `382a28bc` pushed to `origin/main`.

## Files

- `docs/project-charter.md`
- `docs/INDEPENDENT_PARTNER_STORE_PLATFORM_PLAN.md`
- `.ai-company/memory/tasks/TASK-20260709-021-independent-store-project-declaration/*`
- `.ai-company/memory/ACTIVE_CONTEXT.md`
