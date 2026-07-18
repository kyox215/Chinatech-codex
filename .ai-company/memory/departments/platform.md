---
schema_version: 1
department: platform
status: active
owner: Platform Department / Integration Lead
last_verified_at: 2026-07-17
review_trigger: relevant-task-or-quarterly-review
---

# Platform / SRE Department Memory

## Mission and boundary

CI/CD, infrastructure, environments, SLOs, monitoring, release, rollback, backup, and incidents.

This department advises and maintains its own standards. It does not obtain
legal, financial, production, or organization authority merely by being named
as owner of this file.

## Current objectives and work in progress

- Maintain local runtime, CI, Vercel/Supabase deployment assumptions, environment variables, and sandbox caveats.
- First priority: verify live Vercel/Supabase state only with owner-approved access.

## Verified rules and conventions

- Node `22.12.0` is configured.
- `vercel.json` builds with `npm run build`.
- GitHub CI runs lint, typecheck, test, and build; E2E is manual.
- Local sandbox can block Turbopack build port binding; unsandboxed rerun passed on 2026-06-19.
- TASK-009 production state was scoped-verified on 2026-07-10: `origin/main=cee5a1b4`, Vercel deployment `dpl_CehRUKZ7WhybvvJhbaFFQZjwnwKA` is Ready on production aliases, and the first 20-minute error scan returned no entries.
- `TASK-20260716-003-customer-finance-order-correction-plan` scoped-verified Vercel production deployment `dpl_Buv1EGr9wizVgZ1YogCKgwSGenbq`: exact application SHA `e83527379ddc048940ac628fb72821d60b2c8c91`, `READY`, both production domains promoted, anonymous auth-boundary smoke passed, and no runtime error cluster or error/fatal log appeared in the observed 30-minute window. The earlier identity-blocked attempt made no runtime change.
- `TASK-20260716-005-device-custody-status-implementation` scoped-verified Vercel deployment `dpl_9ovqtzqJ9ZuAnNd852skDYFtC7Gv`: exact SHA `452f89855e83aa4104bc2945e0ca087bbffca77c`, Next.js 16.2.6 Turbopack/TypeScript build, production aliases, anonymous login/API boundary and zero exact-deployment error/fatal/5xx logs. During the official Git-linked deployment incident, cancel only redundant queued copies and retain one clean-worktree CLI deployment; never treat queue delay as code failure.
- `TASK-20260717-007-store-lifecycle-implementation` verified that `origin/main` includes implementation commit `55cb7ab5a928b67daf4856e80486f2ccec5fbd59` and that linked Supabase project `xluzcoduqsdvjoouqhkc` contains the six migrations. The five runtime flags remain off; this release included no direct feature activation or store mutation.

## Interfaces and dependencies

| Provides / consumes | Counterparty | Contract | Failure handling | Evidence | Status |
|---|---|---|---|---|---|
| Exact-SHA application release | Operations + QA + Integration Lead | Verify commit metadata, `READY`, production aliases, protected-route/API behavior and scoped runtime errors | Keep prior aliases when blocked/failed; forward-fix or deliberately roll back only after compatibility review | TASK-20260716-003-customer-finance-order-correction-plan E-027..E-031 | scoped_verified |

## SOPs and checklists

- Relevant Skills under `.agents/skills/` are candidate procedures.
- Project-specific commands and paths require verification before promotion.

## Risks, debt, and open questions

| ID | Risk/debt/question | Impact | Owner | Target/review | Status |
|---|---|---|---|---|---|
| PLAT-20260619-001 | Broad live Vercel/Supabase deployment state is not continuously verified | Release readiness can drift; TASK-009 supplies only one scoped timestamp | Platform + Operations | before each release | open |
| PLAT-20260619-002 | Sandbox build failure can be misread as code failure | Wasted debugging | Platform + QA | health-check runbook | open |
| PLAT-20260710-001 | Multiple release executors can mutate DB/Git/deploy state from a shared workspace | Control-plane race and unreliable evidence | Platform + Operations + Integration Lead | add serialized release lock before next production write | open |

## Lessons and anti-patterns

- Do not infer project facts from the generic AI Company OS template.
- Promote repeated evidence, not stylistic preference, into durable standards.
- Never carry a preflight result across an overlapping executor window; assert remote migration, Git and deployment state immediately before and after each production write.

## Capability and tool notes

| Agent/Skill | Current evidence | Capability | Permission | Limitation |
|---|---|---|---|---|
| TBD | none | C0/C1 | task-specific | not evaluated |

## Memory change log

| Date | Change | Source/task | Author/reviewer | Status |
|---|---|---|---|---|
| 2026-06-19 | Initial RepairDesk platform baseline synchronized | TASK-20260619-003 | Integration Lead | active |
| 2026-07-10 | Added scoped production deployment evidence and serialized-release requirement | TASK-20260710-009 | Integration Lead | active |
| 2026-07-13 | Recorded owner-approved direct-main code release after agents/lint/typecheck, 898 tests, Webpack build, responsive browser matrix and independent QA/UX PASS; no DB or manual deployment action included | TASK-20260713-002-order-search-grouped-results | Integration Lead | release_approved |
| 2026-07-17 | Recorded Owner-linked exact-SHA Vercel production release, contained identity failure, auth-boundary smoke and clean runtime observation | TASK-20260716-003-customer-finance-order-correction-plan | Integration Lead + release reviewers | scoped_verified |
| 2026-07-17 | Recorded DB-first custody release, official Vercel queue incident handling, exact-SHA CLI deployment and clean runtime smoke | TASK-20260716-005-device-custody-status-implementation | Integration Lead + release reviewers | scoped_verified |
