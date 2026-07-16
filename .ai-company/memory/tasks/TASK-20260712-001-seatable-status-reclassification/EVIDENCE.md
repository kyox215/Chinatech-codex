# Evidence Index — TASK-20260712-001-seatable-status-reclassification

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-11T23:17:10Z | 鹤祥 |
| E-002 | backup | exact 24-row before-image exists without report PII | `/tmp/repairdesk-seatable-reclassify/candidate-backup-20260712.json` SHA-256 `94bac2d...c34a1c855` | passed | 2026-07-11T23:20Z | Integration Lead |
| E-003 | production rehearsal | exact transaction body updates 24 rows and then forces rollback | `reclassify-rehearsal-rollback.sql` | PASS; 24 rows/events; totals unchanged | 2026-07-11T23:25Z | Integration Lead |
| E-004 | rollback verification | rehearsal left baseline unchanged | independent `post-rehearsal-check.sql` | 24 candidates, 0 patch events/audits, 6285/6289 target counts | 2026-07-11T23:26Z | Integration Lead |
| E-005 | production commit | exact guarded transaction committed | batch `seatable-status-reclassify-20260712-v1` | PASS; 24 orders + 24 events | 2026-07-11T23:27Z | Integration Lead |
| E-006 | post-commit verification | source states, canonical fields, money, activity, and tenant isolation | `post-commit-check.sql` + receipt | PASS; 0 canonical mismatches | 2026-07-11T23:28Z | Integration Lead |
| E-007 | recovery rehearsal | selective restoration executed in transaction and forced rollback | `selective-rollback-rehearsal.sql` | PASS; corrected production state preserved afterward | 2026-07-11T23:30Z | Integration Lead |
| E-008 | targeted tests | mapper and business grouping | `npx vitest run ...` | 2 files, 13 tests passed | 2026-07-11T23:24Z | Integration Lead |
| E-009 | full quality gate | rules, lint, types, regression, build | `npm run agents:check`, `lint`, `typecheck`, `test`, `build` | PASS; 107 files/718 tests; 22 pages built | 2026-07-11T23:32Z | Integration Lead |
| E-010 | visual evidence | backend production data operation has no safe PII-free task page | aggregate receipt replaces screenshot | not applicable | 2026-07-11T23:32Z | Integration Lead |
| E-011 | repository packaging | task code is reconciled with latest main and current security boundary | targeted 4 files / 24 tests; full 140 files / 960 tests; lint; typecheck; agents check; webpack build | PASS; no production command | 2026-07-16T18:04:44Z | Integration Lead + DATA/SEC/QA reviewers |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
