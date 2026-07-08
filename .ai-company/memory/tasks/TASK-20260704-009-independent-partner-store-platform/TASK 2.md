---
schema_version: 1
task_id: "TASK-20260704-009-independent-partner-store-platform"
title: "Independent partner store platform planning"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Architecture", "Data", "Documentation", "Product", "Security"]
created_at: "2026-07-04T19:27:42Z"
updated_at: "2026-07-04T22:59:04Z"
closed_at: "2026-07-04T22:56:29Z"
---
# Task — Independent partner store platform planning

## Owner request

Write the independent partner store platform direction into project documents, keep a durable progress/update record, and begin the planning execution track.

## Business value

Reframe RepairDesk from internal multi-store staff management into a privacy-first multi-tenant platform for independent partner store owners.

## Scope in

- Reframe multi-store planning from "one company with branches/employees" to "independent partner store owners".
- Create a long-term product/architecture/privacy plan document.
- Create a progress and decision log for future updates.
- Add project-memory pointers so future work uses the independent partner-store model.
- Create a Phase 1 gated execution contract with sub-agent review results.
- Execute the approved Phase 1 runtime baseline in gated small goals after the owner requested implementation.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Create authoritative long-term plan document for independent partner store platform.
- [x] Create durable progress/update document for phases, decisions, and future planning.
- [x] Record current direction in project memory without changing application behavior.
- [x] Create Phase 1 execution contract and record sub-agent review baseline.
- [x] Pass SG0 documentation/checkpoint gate before starting runtime implementation.
- [x] Start and pass SG1 platform/store approval-boundary implementation.
- [x] Start and pass SG2 owner-email request routing refinement.
- [x] Start and pass SG3 self-serve independent store creation alignment.
- [x] Start and pass SG4 final role, cancellation, and rejection visibility.
- [x] Start and pass SG5 owner invitation primary path.
- [x] Start and pass SG6 invite code / invite link model.
- [x] Start and pass SG7 Phase 1 closeout gate.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verified |
| Existing multi-store plan was enterprise/branch flavored | observed | `docs/ENTERPRISE_MULTI_STORE_TENANCY_PLAN.md` | marked as historical reference |
| Active plan source exists | observed | `docs/INDEPENDENT_PARTNER_STORE_PLATFORM_PLAN.md` | created |
| Progress log exists | observed | `docs/INDEPENDENT_PARTNER_STORE_PLATFORM_PROGRESS.md` | created |
| Project memory points to new direction | observed | `.ai-company/memory/PROJECT_MEMORY.md` | updated |
| Phase 1 execution contract exists | observed | `docs/INDEPENDENT_PARTNER_STORE_PHASE1_EXECUTION_PLAN.md` | created; SG0-SG6 validation passed; SG7 closeout active |
| Real read-only sub-agents reviewed Phase 1 | observed | Product, Architecture, Data, Security sub-agent IDs | completed; integrated into execution contract |
| SG1 approval boundary implementation passed | observed | `src/features/platform/server/platform.repository.ts`, `src/features/stores/server/store.repository.ts`, `src/features/platform/model/onboarding-review-policy.ts`, related tests | implemented and verified |
| SG2 owner-email routing implementation passed | observed | `src/features/platform/server/platform.repository.ts`, `src/server/api/repairdesk-schemas.ts`, `supabase/migrations/20260704203000_onboarding_owner_email_routing_hardening.sql`, related tests | implemented and verified |
| SG3 self-serve store creation implementation passed | observed | `src/features/auth/screens/onboarding-screen.tsx`, `src/features/stores/server/store.repository.ts`, `src/server/api/repairdesk-router.ts`, related tests | implemented and verified |
| SG4 request lifecycle implementation passed | observed | `src/features/auth/screens/onboarding-screen.tsx`, `src/features/platform/server/platform.repository.ts`, `src/features/stores/server/store.repository.ts`, `supabase/migrations/20260704212000_onboarding_approved_role_and_cancel.sql`, related tests | implemented and verified |
| SG5 owner invitation primary path passed | observed | `src/features/auth/screens/onboarding-screen.tsx`, `src/features/settings/screens/settings-screen.tsx`, `src/features/stores/server/store.repository.ts`, `src/features/platform/server/platform.repository.ts`, `supabase/migrations/20260704220843_store_invitations_non_owner_role.sql`, related tests | implemented and verified locally; production migration preflight retained |
| SG6 invite code/link model passed | observed | `src/features/stores/server/store.repository.ts`, `src/features/settings/screens/settings-screen.tsx`, `src/features/auth/screens/onboarding-screen.tsx`, `supabase/migrations/20260704221944_store_invite_links.sql`, related tests | implemented and verified locally; QA/Security/Data gates passed; production migration preflight retained |
| SG7 Phase 1 closeout passed | observed | final validation, final QA/security/release/documentation reviews, progress/task memory | local closeout complete; Phase 2 tenant isolation audit ready; production release not approved |

## Decision and approval points

- Owner confirmed the recommended D1-D4 baseline:
  - D1=C hybrid isolation.
  - D2=D all join mechanisms, with owner invitation primary.
  - D3=B platform business-data visibility only after time-limited owner authorization.
  - D4=A self-serve store creation first.
- Current decision point is Phase 2 tenant isolation audit start. Production release remains separately gated by migration preflights, observability, rollback ownership, and owner approval.
- Phase 1 sequencing decision from sub-agent review: SG1 approval boundary, SG2 owner-email routing, SG3 self-serve store creation, SG4 final role/cancel/rejection, SG5 owner invitation acceptance, SG6 invite code/link, SG7 closeout.

## Work packages

- Planning documents.
- Progress and decision log.
- Project memory pointer.
- Follow-up owner choice capture.
- Phase 1 gated execution contract and SG0 review record.
- SG1 approval-boundary implementation and review-gate record.
- SG2 owner-email routing implementation and review-gate record.
- SG3 self-serve store creation implementation and review-gate record.
- SG4 final role, cancellation, rejection visibility, and review-gate record.
- SG5 owner invitation primary path implementation and review-gate record.
- SG6 invite code / invite link model implementation and review-gate record.
- SG7 Phase 1 closeout, release-preflight summary, and final review-gate record.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
