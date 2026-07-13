# Documentation Impact Matrix

## WP-01 settings shell

| Reader             | Impact                                                                                            | Authoritative update                                                                                             | Verification                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Store users        | `/settings` now opens a searchable overview; valid `?section=` deep links remain stable           | The UI registry and overview copy are the source of truth; screenshots are listed in `EVIDENCE.md`               | Six-viewpoint mock E2E and browser screenshots                                 |
| Developers         | Section metadata, access state, and query activation are centralized                              | `settings-section-registry.ts`, `settings-section-access.ts`, `settings/api/query-options.ts`, plus `HANDOFF.md` | Typecheck and unit tests                                                       |
| QA                 | Settings has a dedicated mock E2E command and is included in the interaction gate                 | `package.json` and `tests/e2e/settings-section-interactions.spec.ts`                                             | 9/9 settings E2E                                                               |
| Security reviewers | Blocked deep links do not activate protected domain queries; drafts are bound to the active store | `CHECKPOINTS.md` and the executable model/query contracts                                                        | Capability projection test, store-switch integration test, blocked-request E2E |
| Release / SRE      | No migration, environment variable, deployment, or production-data step was added in WP-01        | Existing release and database gates remain unchanged                                                             | Production build only; no deployment performed                                 |

## Updated documentation

- `TASK.md`: current phase and acceptance state.
- `CHECKPOINTS.md`: WP-01 decisions, validation, residual work, and next action.
- `EVIDENCE.md`: full test/build/E2E/browser evidence and screenshot paths.
- `HANDOFF.md`: WP-02 starting contract and navigation surfaces that must join the dirty guard.
- `MEMORY_DELTA.md`: stable overview/query/draft decisions.

## WP-02 draft and navigation safety

| Reader             | Impact                                                                                                       | Authoritative update                                                                                                            | Verification                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Store users        | Store/output/rule edits save by section; conflicts and validation failures keep local input; leaving prompts | Save/state cards, unsaved-change dialog, and `ADR-WP02-SETTINGS-DRAFT-SAFETY.md`                                                | SettingsScreen tests and 16-case Settings E2E                   |
| Developers         | Settings update is a strict section union with actor-bound store context and `updated_at` CAS                | `store-settings-update-contract.ts`, draft model, message-settings service/repository, navigation guard provider, and WP-02 ADR | Contract/service/repository/router/provider tests and typecheck |
| QA                 | Global navigation surfaces must not bypass dirty state; multi-section saves must chain versions              | `tests/e2e/settings-section-interactions.spec.ts` and WP-02 checkpoint                                                          | 16/16 Playwright and 3 files / 24 focused tests                 |
| Security reviewers | Client store IDs never authorize writes; over-posting is rejected; audit omits setting values                | WP-02 ADR, service/repository implementation, and security review evidence                                                      | Independent PASS, 7 files / 51 tests                            |
| Release / SRE      | Frontend and backend strict contract must ship together; no migration was added                              | WP-02 ADR migration/rollback section and `CHECKPOINTS.md`                                                                       | Build passed; production/push/deploy gates remain closed        |

### WP-02 documentation limits

- Browser hard reload uses the native unsaved-change prompt; the custom three-choice dialog applies only to application-controlled navigation.
- No database or RLS document changed because WP-02 uses the existing `updated_at` column and adds no migration.
- Transactional audit/outbox design is intentionally deferred and recorded as a residual risk, not an implemented guarantee.
- Final user-facing operator documentation and final visual evidence remain deferred until WP-03 through WP-07 workflows stabilize and WP-08 performs closeout.

## No update required

- Database schema, migration, RLS, deployment, and rollback documents: WP-01 contains no database or production change.
- Public API documentation: no public endpoint or payload changed.
- Account self-service plan: `/settings?section=account` remains a thin link to `/account` for security actions.

## WP-03A customer-output recovery

| Reader             | Impact                                                                                                             | Authoritative update                                                             | Verification                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Store users        | Blocked messages/receipts now explain the missing area, preserve the dialog, open exact Settings, and can recheck  | `StoreOutputIdentityRecovery`, four dialog integrations, and the two screenshots | 2/2 responsive recovery E2E                                         |
| Developers         | Output blocking has stable semantic cause/field/target metadata; callers provide capability and retry callbacks    | `store-output-identity.ts` and `ADR-WP03-OUTPUT-IDENTITY-RECOVERY.md`            | Resolver/component/dialog tests and typecheck                       |
| QA                 | Recheck must move blocked UI to ready without weakening send/print guards; first mobile order must remain tappable | `tests/e2e/store-output-recovery.spec.ts` and the WP03-A checkpoint              | 5 files / 21 focused tests, 18 Playwright cases, 139/902 full tests |
| Security reviewers | Mismatch never links Settings; blocked output fields remain empty; URLs carry no store/customer data               | Resolver invariants and permission-aware shared component                        | Independent PASS, P0=0 / P1=0                                       |
| Release / SRE      | Additive frontend/domain contract only; no migration, external message, production write, push, or deploy          | WP03 ADR rollout/rollback section, `CHECKPOINTS.md`, and current hard-stop list  | Production build passed locally                                     |

### WP-03A documentation limits

- Public Kiosk must not reuse the private recovery component; authenticated/public Kiosk recovery remains a later reviewed slice.
- Toast-only order-list/buyback feedback, silent order-detail print, and Messages template-health composition remain WP03 follow-ups.
- Settings-query retry is best effort; persistent server errors continue to fail closed.

## Deferred documentation

- A user-facing Settings operator guide should be written after WP-03 through WP-07 complete the nine child functions; writing it now would document incomplete workflows.
- WP-02 must document the exact limits of the unsaved-change guard, especially native browser reload behavior.

## WP-03C notifications, print, and default rules

| Reader             | Impact                                                                                                          | Authoritative update                                                                                           | Verification                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Store users        | Notification/print previews update from the current section draft; restoring defaults still requires Save       | `notifications-settings-section.tsx`, `rules-settings-section.tsx`, and six WP03-C screenshots                 | 28-case Settings E2E and in-app browser inspection           |
| Developers         | Warranty uses omitted/zero/positive semantics; intake snapshots the tenant default and sale never rereads it    | `store-setting-defaults.ts`, API schemas, `inventory-warranty-default.repository.ts`, and inventory repository | Focused repository/schema/mock/receipt tests                 |
| QA                 | Editable/read-only child pages, long previews, dirty navigation, confirmation focus, and six widths are covered | `tests/e2e/settings-section-interactions.spec.ts` and WP03-C checkpoint                                        | 10 files / 72 focused tests and 28/28 Playwright             |
| Security reviewers | Template links require the server capability; tenant default reads are store-scoped and fail closed             | Settings screen capability projection and inventory warranty repository                                        | Independent PASS, P0=0/P1=0                                  |
| Release / SRE      | No schema, migration, environment, production write, role/retention, push, or deployment step was introduced    | `CHECKPOINTS.md`, `EVIDENCE.md`, and the existing release hard-stop list                                       | Full 149-file regression, lint, typecheck, build, diff check |

### WP-03C documentation limits

- SeaTable import warranty behavior is unchanged and must not be described as inheriting the Settings default.
- Historical inventory keeps its intake snapshot; changing a store default affects only later intake records that omit an override.
- Final operator documentation remains deferred until WP-04 through WP-07 stabilize the remaining child functions.

## WP-04 members, access requests, and suppliers

| Reader             | Impact                                                                                                                    | Authoritative update                                                                                                 | Verification                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Store users        | Member roles/grants are staged and confirmed; access requests are reviewable; supplier edit/archive works responsively    | Member/supplier Settings sections and three WP-04 screenshots                                                        | 33-case Settings E2E                                        |
| Developers         | Member management is server-projected; stale responses are epoch-gated; supplier UI/API share one strict input contract   | `store.repository.ts`, `settings-screen.tsx`, store/supplier mock APIs, supplier contract, realtime invalidation map | Targeted 29-file regression and typecheck                   |
| QA                 | Role-only vs grant-only saves, access approve/reject, duplicate confirms, focus, 44px, and six widths are contractual     | `tests/e2e/settings-section-interactions.spec.ts` and WP-04 checkpoint                                               | 220 targeted tests, 989 full tests, 33/33 Playwright        |
| Security reviewers | Inactive targets fail closed; object management remains server-authoritative; over-posted supplier store IDs are rejected | Server projection/repository guards and strict Zod contract                                                          | Independent security PASS, P0=0/P1=0                        |
| Release / SRE      | Local UI/API slice is ready, but production member RPC and transaction guarantees remain blocked                          | `CHECKPOINTS.md`, `EVIDENCE.md`, and Owner gate list                                                                 | Local build only; no migration, push, deploy, or production |

### WP-04 documentation limits

- Do not document member role/status/grant changes as production-ready until the pending RPC migration and post-apply verification are approved and completed.
- Do not promise atomic member/access/audit writes or supplier-name uniqueness; both remain recorded production-strength follow-ups.
- The email invitation workflow creates an in-system pending invitation and does not automatically send email.
- Final end-user Settings operator documentation remains deferred until WP-05 through WP-07 stabilize the remaining child functions.

## WP-05 Kiosk/customer iPad

| Reader             | Impact                                                                                                                     | Authoritative update                                                                                        | Verification                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Store users        | Pair devices, review submitted customer forms, return corrections, and revoke access through responsive confirmations      | Kiosk Settings section, public Kiosk screen, and three WP-05 screenshots                                    | Six-width Kiosk E2E plus final full flow                |
| Developers         | Public/staff DTOs are allowlisted; pair/submit use CAS; return drafts join store-bound dirty navigation                    | Kiosk model/repository/router/source, return-draft model, Settings screen, Realtime mapping                 | Targeted tests, typecheck, full regression              |
| QA                 | Unauthorized clears PII while transient failure retains the form; duplicate actions lock; 44px and no overflow apply       | Kiosk unit tests and `tests/e2e/settings-section-interactions.spec.ts`                                      | 1018 full tests and responsive browser evidence         |
| Security reviewers | Review is owner/manager only; anonymous errors are fixed; Supabase-backed collection/review remains fail closed            | Router/repository assertions, public error contract, `kiosk-review-gate.ts`, and checkpoint Owner-gate list | Three independent reviews at P0=0/P1=0                  |
| Release / SRE      | Local slice is conditionally ready; database transaction, limiting, retention, migration apply, and both flags are blocked | `CHECKPOINTS.md`, `EVIDENCE.md`, `HANDOFF.md`, and WP05-B ADR                                               | No migration, production write, push, deploy, or enable |

### WP-05 documentation limits

- Do not document the Kiosk workflow as production-ready while both Kiosk flags and the transaction/constraint/retention/limiting gates remain unresolved.
- Do not promise that customer/order/attachment/session/event/audit changes are atomic; the local CAS protections cover only bounded stale-state races.
- The three screenshots contain synthetic mock data only and are interaction evidence, not production database proof.
- Final end-user Settings operator documentation remains deferred until WP-06 and WP-07 stabilize and WP-08 performs release closeout.

## WP05-B Kiosk database/public-entry hardening

| Reader             | Impact                                                                                                                        | Authoritative update                                                                              | Verification                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Store users        | No linked behavior is enabled; a viewed-version mismatch is rejected before the review path starts                            | `ADR-WP05B-KIOSK-DATABASE-HARDENING.md` and the Kiosk review-version contract                     | Focused model/API/repository/UI tests                      |
| Developers         | Production and Supabase-backed Kiosk require both flags end to end; review uses the viewed version; raw signatures are pruned | Kiosk gate/public HTTP helper, strict API schemas, repository/mock implementation, and WP05-B ADR | Route, gate, repository, mock, and TypeScript checks       |
| QA                 | Explicit anonymous handler responses are no-store/same-origin with stable 403/503 errors; blocked modes avoid source calls    | `kiosk-routes.test.ts`, private-router integration tests, and gate tests                          | 160 files / 1034 tests plus final production build         |
| Security reviewers | Session payloads duplicate less PII; post-review rows retain signature state/reference instead of a Base64 image              | Kiosk repository/model/public DTO contracts and `ADR-WP05B-KIOSK-DATABASE-HARDENING.md`           | Independent security diff review                           |
| Data / Release     | One additive, unapplied `NOT VALID` migration is staged; both Kiosk switches are documented default-off                       | Migration, `WP05B_DATABASE_APPROVAL_PACKET.md`, and `.env.example`                                | Static contract passes; executable Gate 2A remains blocked |

### WP05-B updated authoritative documentation

- `ADR-WP05B-KIOSK-DATABASE-HARDENING.md`: staged architecture, rejected shortcuts, security/privacy boundaries, and release gates.
- `WP05B_DATABASE_APPROVAL_PACKET.md`: exact linked read-only preflight, migration-order stop conditions, post-checks, and excluded decisions.
- `DOCUMENTATION_IMPACT.md`: reader/behavior/configuration/database mapping.
- `.env.example`: both Kiosk switches are explicit, default to `0`, and cover every Supabase-backed non-E2E runtime.

### WP05-B deferred or intentionally unchanged documentation

- No end-user operator guide update: production Kiosk remains disabled and the visible workflow did not gain a releasable user behavior.
- No retention schedule or consent copy: legal/purpose decisions are not approved.
- No role matrix update: reviewer-role semantics are frozen.
- No production runbook activation step: both environment flags, migration apply, deployment, and push remain Owner gates.
