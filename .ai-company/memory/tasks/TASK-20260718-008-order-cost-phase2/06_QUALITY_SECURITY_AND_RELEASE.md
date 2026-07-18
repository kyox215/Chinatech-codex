# Stage 06 — Quality, Security and Release Readiness

Status: pending

## Goal

Prove acceptance, repair independent findings, synchronize documentation and produce an executable release packet.

## Validation matrix

- `npm run agents:check`
- `npm run lint`
- `npm run typecheck`
- Targeted Phase 2 Vitest suites
- Full `npm run test`
- `npm run build`
- Local migration replay/schema-clone tests and SQL behavior transactions
- Permission, RLS, ACL, RPC, tenant, audit and forbidden-field scans
- Browser E2E for Profit Center, order cost source, parts purchase, export and backfill preview
- Viewports: 390×844, 430×932, 768×1024, 1024×768, 1280×800, 1440×900
- Relevant screenshots without secrets or customer PII

## Exit criteria

- Independent Architecture/Data/Security/QA reviews have no unresolved BLOCKER or MAJOR.
- Documentation, runbook, rollback and feature-flag contracts match code.
- Release candidate diff contains only TASK-008 files.
- A pre-release checkpoint records exact commit and migration candidates.

