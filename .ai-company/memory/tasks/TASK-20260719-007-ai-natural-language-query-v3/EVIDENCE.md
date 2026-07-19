# Evidence — TASK-20260719-007

| ID | Gate | Evidence | Result | Time |
|---|---|---|---|---|
| E-001 | baseline | `origin/main@25752bd1`; isolated clean worktree | PASS | 2026-07-19T19:09:28Z |
| E-002 | root preservation | root checkout ahead 2 / behind 108 with extensive unrelated dirty state; no root edits | PASS | 2026-07-19T19:09:28Z |

| E-003 | architecture | deterministic parser + model candidate + closed-world server compiler; repository only receives server-validated constraints | PASS | 2026-07-19T20:13:30Z |
| E-004 | exact regression | fixed `2026-07-19` Europe/Rome: “检查半年内所有的苹果15系列的手机” => iPhone 15, `2026-01-19..2026-07-19`, `view=all`, no finance filter | PASS | 2026-07-19T20:13:30Z |
| E-005 | adversarial provider | provider-invented Samsung A12, previous-month, amount anomaly and active-only fields are discarded before repository execution | PASS | 2026-07-19T20:13:30Z |
| E-006 | date engine | real Gregorian validation; absolute/open/range/rolling/calendar/month/year/quarter/all-time; invalid/reversed/ambiguous dates clarify without repository fallback | PASS | 2026-07-19T20:13:30Z |
| E-007 | focused tests | 9 focused files, 156 tests | PASS | 2026-07-19T20:13:30Z |
| E-008 | full quality gates | final rebased candidate: `npm run lint`; `npm run typecheck`; Vitest 311 files / 2,033 tests | PASS | 2026-07-19T20:20:03Z |
| E-009 | production build | `npx next build --webpack`; compiled, typechecked, 26 static pages generated | PASS | 2026-07-19T20:13:30Z |
| E-010 | target browser E2E | local and model Apple 15 scenarios in independent Chromium workers; 2/2 passed; no Samsung result and page-inline details preserved | PASS | 2026-07-19T20:13:30Z |
| E-011 | responsive visual | 390/430/768/1280 dialog and document have no horizontal overflow; browser console has no warning/error | PASS | 2026-07-19T20:13:30Z |
| E-012 | visual evidence | `screenshots/TASK-20260719-007-ai-natural-language-query-v3/` contains 390 collapsed, 1280 collapsed and 1280 expanded-scope evidence | PASS | 2026-07-19T20:13:30Z |
| E-013 | security boundary | archive permission fails closed; PII egress check retained; invalid dates do not broaden; inline actions remain disabled; no schema/env/secret change | PASS | 2026-07-19T20:13:30Z |
| E-014 | E2E environment note | serial full-file dev runs showed repeatable Next dev hydration stalls at store-context wait; the affected core scenarios pass in isolated workers and production build passes; production-mode E2E bypass is intentionally disabled by source policy | CONDITIONAL / tooling only | 2026-07-19T20:13:30Z |
| E-015 | remote rebase | candidate rebased without conflict from `25752bd1` onto `origin/main@1119ef5d`; final diff remains one scoped commit and clean | PASS | 2026-07-19T20:20:03Z |
| E-016 | post-rebase build | final rebased candidate compiled, typechecked and generated 26 static pages with Webpack | PASS | 2026-07-19T20:20:03Z |
| E-017 | main integration | non-force push completed; `origin/main` resolves exactly to business commit `445b5e8117fd5bd8fcad33eb4ea120a5688e1816` | PASS | 2026-07-19T20:26:45Z |
| E-018 | exact deployment | Vercel deployment `dpl_9e2FqCMMyfKuRiyHVHcbUzm7NVSc` is `READY`, target `production`, with exact Git SHA `445b5e8117fd5bd8fcad33eb4ea120a5688e1816` and aliases `www.chinatech.in` / `chinatech.in` | PASS | 2026-07-19T20:26:45Z |
| E-019 | production smoke | `www` and bare-domain login routes return 200; manifest returns 200; anonymous capabilities and order-turn calls return 401; exact deployment login returns 200 | PASS | 2026-07-19T20:26:45Z |
| E-020 | production observation | error/fatal log scan for the exact deployment over the post-release 15-minute window returned zero entries; no provider call or customer data used | PASS | 2026-07-19T20:26:45Z |
| E-021 | closeout governance | CEO report, memory change set, capability review, department memory, project memory and rollback record synchronized; no authority upgrade granted | PASS | 2026-07-19T20:26:45Z |
