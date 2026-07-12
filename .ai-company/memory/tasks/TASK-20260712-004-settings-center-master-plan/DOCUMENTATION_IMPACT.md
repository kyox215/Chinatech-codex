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

## No update required

- Database schema, migration, RLS, deployment, and rollback documents: WP-01 contains no database or production change.
- Public API documentation: no public endpoint or payload changed.
- Account self-service plan: `/settings?section=account` remains a thin link to `/account` for security actions.

## Deferred documentation

- A user-facing Settings operator guide should be written after WP-03 through WP-07 complete the nine child functions; writing it now would document incomplete workflows.
- WP-02 must document the exact limits of the unsaved-change guard, especially native browser reload behavior.
