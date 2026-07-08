# Handoff — TASK-20260707-001 Shared Database Tenant Onboarding

## Resume First

1. Read `docs/SHARED_DB_TENANT_ONBOARDING_EXECUTION_PLAN.md`.
2. Read this task's `TASK.md`, `EVIDENCE.md`, and latest `CHECKPOINTS.md`.
3. Wait for or inspect sub-agent results:
   - Iris `019f3c34-a726-7121-9864-b4394aa6ba39` completed.
   - Delta `019f3c35-0abb-7130-bdf5-cd36dcf65a9d` completed.
   - Aegis `019f3c35-4ecd-7d40-aafd-b3901ca62ff8` completed.
4. Update `docs/INDEPENDENT_PARTNER_STORE_PLATFORM_PLAN.md` and progress docs to align with shared-database-only direction.

## Next Implementation Slice

Start Phase 1 locally with onboarding/auth hardening:

1. Verified-email gating for create-store, join request, invite redemption, and invitation acceptance.
2. Owner-only manager grants and member-management permission alignment.
3. CSRF/Origin protection for unsafe cookie-authenticated onboarding/store/member mutations.
4. Rate limits for create-store, owner-email join requests, invite redemption, and cancel/reapply loops.

## Boundaries

- Do not apply production migrations.
- Do not deploy or push without explicit owner request.
- Do not implement per-store physical database provisioning.
- Preserve unrelated dirty worktree changes.
