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

| Reader             | Impact                                                                                                      | Authoritative update                                                                                                            | Verification                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Store users        | Store/output/rule edits save by section; conflicts and validation failures keep local input; leaving prompts | Save/state cards, unsaved-change dialog, and `ADR-WP02-SETTINGS-DRAFT-SAFETY.md`                                                | SettingsScreen tests and 16-case Settings E2E                                 |
| Developers         | Settings update is a strict section union with actor-bound store context and `updated_at` CAS                | `store-settings-update-contract.ts`, draft model, message-settings service/repository, navigation guard provider, and WP-02 ADR | Contract/service/repository/router/provider tests and typecheck               |
| QA                 | Global navigation surfaces must not bypass dirty state; multi-section saves must chain versions             | `tests/e2e/settings-section-interactions.spec.ts` and WP-02 checkpoint                                                           | 16/16 Playwright and 3 files / 24 focused tests                               |
| Security reviewers | Client store IDs never authorize writes; over-posting is rejected; audit omits setting values                | WP-02 ADR, service/repository implementation, and security review evidence                                                       | Independent PASS, 7 files / 51 tests                                          |
| Release / SRE      | Frontend and backend strict contract must ship together; no migration was added                              | WP-02 ADR migration/rollback section and `CHECKPOINTS.md`                                                                        | Build passed; production/push/deploy gates remain closed                      |

### WP-02 documentation limits

- Browser hard reload uses the native unsaved-change prompt; the custom three-choice dialog applies only to application-controlled navigation.
- No database or RLS document changed because WP-02 uses the existing `updated_at` column and adds no migration.
- Transactional audit/outbox design is intentionally deferred and recorded as a residual risk, not an implemented guarantee.
- Final user-facing operator documentation and final visual evidence remain deferred until WP-03 through WP-07 workflows stabilize and WP-08 performs closeout.

## No update required

- Database schema, migration, RLS, deployment, and rollback documents: WP-01 contains no database or production change.
- Public API documentation: no public endpoint or payload changed.
- Account self-service plan: `/settings?section=account` remains a thin link to `/account` for security actions.

## Deferred documentation

- A user-facing Settings operator guide should be written after WP-03 through WP-07 complete the nine child functions; writing it now would document incomplete workflows.
- WP-02 must document the exact limits of the unsaved-change guard, especially native browser reload behavior.
