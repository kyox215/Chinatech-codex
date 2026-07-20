# Documentation Sync — AI ledger lifecycle fence hotfix

| Audience                  | Authority                                        | Impact                                                                                                            | Action                                     |
| ------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| AI operations / support   | `docs/AI_ASSISTANT_LIVE_PILOT_RUNBOOK.md`        | Production paid path is currently fail-closed; root cause, exact pending migration, smoke and observation changed | Updated                                    |
| DATA / AI engineering     | `docs/AI_ASSISTANT_COST_GOVERNANCE.md`           | Mixed-scope bucket fence and reservation/lifecycle lock contract added                                            | Updated                                    |
| Store lifecycle operators | `docs/STORE_LIFECYCLE_IMPLEMENTATION_RUNBOOK.md` | Seventh migration is applied; eighth repair is pending; unresolved AI reservation blocks close                    | Updated                                    |
| Release operator          | task `RELEASE_PLAN.md`                           | Exact apply, postcheck, stop and recovery steps required                                                          | Added                                      |
| QA                        | migration static test + PG17 fixture             | Real DB behavior and concurrency are required in addition to string assertions                                    | Added/updated                              |
| End user / UI             | UI declarations and screenshots                  | No page, label, route, component or interaction changed                                                           | No update required                         |
| API consumer              | TypeScript/API docs                              | No HTTP shape, RPC signature or application contract changed                                                      | No update required                         |
| Security/privacy          | secret/data handling docs                        | No secret, PII, RLS, policy or grant change                                                                       | No update required; verified in SEC review |

Verification: documentation was checked against the final migration, production aggregate-only preflight, linked dry-run, PG17 behavior/concurrency evidence and reviewer conclusions. No example contains a real key, customer record, prompt, request ID or device identifier.
