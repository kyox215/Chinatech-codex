# Evidence Index — TASK-20260726-001-inventory-phone-sales-complete

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-25T23:27:04Z | Hexiang Huang |
| E-002 | tests | full repository regression before final two guard tests | `npm run test` | 357 files / 2382 tests passed | 2026-07-26T00:00:24Z | Integration Lead |
| E-003 | tests | final inventory guard and workflow behavior | inventory repository + workflow targeted run | 34 tests passed | 2026-07-26T00:02:44Z | Integration Lead |
| E-004 | independent review | final data safety verdict for bounded application slice | data reviewer report | GO for safe UI/validation preparation; migration still required | 2026-07-26T00:03:00Z | Data reviewer |
| E-005 | visual | desktop manual intake source selection | `evidence/inventory-intake-desktop.png` | rendered without overlap | 2026-07-25T23:56:00Z | Integration Lead |
| E-006 | visual | 390px mobile manual intake source selection | `evidence/inventory-intake-mobile-390.png` | 44px controls and compact layout visible | 2026-07-25T23:57:00Z | Integration Lead |
| E-007 | visual | desktop atomic sale confirmation | `evidence/inventory-sale-confirmation-desktop.png` | full confirmation payload visible | 2026-07-25T23:59:00Z | Integration Lead |
| E-008 | interaction | changing payment method revokes final confirmation | local browser check | checkbox changed from checked to false | 2026-07-25T23:59:30Z | Integration Lead |
| E-009 | build | production build | `npm run build` with font network access | passed, 27 static pages generated | 2026-07-25T23:50:00Z | Integration Lead |
| E-010 | final quality gate | complete post-fix validation | `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` | all passed; 357 files / 2384 tests; 27 static pages | 2026-07-26T00:07:00Z | Integration Lead |
| E-011 | data design | atomic workflow invariants, state matrix, CAS, idempotency, privacy and rollback | read-only Data Reviewer final report | complete design; no database writes | 2026-07-26T00:15:00Z | Data Reviewer |
| E-012 | migration safety | dormant expand plus preflight-gated enable migration | `20260726181436_inventory_v2_workflow_expand.sql`, `20260726181537_inventory_v2_workflow_enable.sql` | invoker, empty search path, service-role-only enable, no historical rewrite | 2026-07-26T00:30:00Z | Integration Lead |
| E-013 | production preflight | current V2 projection readiness using aggregate-only read | Supabase read-only SQL on `xluzcoduqsdvjoouqhkc` | marker items 0; missing/link/status/cost/list/gate counts all 0 | 2026-07-26T00:29:00Z | Integration Lead |
| E-014 | final quality gate | complete post-workflow validation | `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` | all passed; 359 files / 2389 tests; 27 static pages | 2026-07-26T00:35:00Z | Integration Lead |
| E-015 | visual | final desktop manual intake source page | `evidence/inventory-v2-workflow-desktop-1440.png` | 1440×900 rendered without overlap | 2026-07-26T00:33:00Z | Integration Lead |
| E-016 | visual | final mobile manual intake source page | `evidence/inventory-v2-workflow-mobile-390.png` | 390×844 responsive card layout and bottom action visible | 2026-07-26T00:34:00Z | Integration Lead |
| E-017 | owner approval | production schema change authorization | Owner reply `批准` after exact migration approval request | explicit approval received | 2026-07-26T18:14:00Z | Hexiang Huang |
| E-018 | production migrations | additive inventory workflow release chain | Supabase migration history on `xluzcoduqsdvjoouqhkc` | `20260726181436`, `20260726181537`, `20260726182246`, `20260726182556` applied | 2026-07-26T18:25:56Z | Integration Lead |
| E-019 | production compatibility | production constrained-text schema executes workflow safely | rollback-only service-role smoke | manual intake, inspection, ready-for-sale, commercial update and sale all returned `ok=true`; V1/V2 status sold; cost €125; list €299; workflow ledger 3; sale ledger 1 | 2026-07-26T18:24:00Z | Integration Lead |
| E-020 | rollback proof | production smoke left no business or audit residue | post-rollback aggregate SQL | V2 markers 0; smoke items 0; smoke units 0; workflow ledger rows 0 | 2026-07-26T18:24:20Z | Integration Lead |
| E-021 | security | production workflow privilege boundary | `pg_proc`, table/type privileges and Supabase Security Advisor | RPC invoker + empty search path; only service role executes; browser roles have no ledger/type access; no new WARN tied to workflow objects | 2026-07-26T18:26:00Z | Integration Lead |
| E-022 | performance | workflow ledger foreign-key indexes | Supabase Performance Advisor after `20260726182556` | all three unindexed-FK notices cleared; only expected unused-index INFO remains on empty ledger | 2026-07-26T18:26:30Z | Integration Lead |
| E-023 | final quality gate | post-production compatibility regression | `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` | all passed; 359 files / 2391 tests; 27/27 static pages | 2026-07-26T18:28:00Z | Integration Lead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-26T18:29:05Z` `6b74e87463` — Supabase migrations 20260726181436/181537/182246/182556; rollback smoke returned item_status=sold, unit_status=sold, workflow_ledger_rows=3, sale_ledger_rows=1; post-rollback marker/smoke/workflow rows=0; lint/typecheck passed; 359 files and 2391 tests passed; build 27/27 pages passed.
