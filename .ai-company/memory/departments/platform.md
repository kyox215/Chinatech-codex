---
schema_version: 1
department: platform
status: active
owner: Platform Department / Integration Lead
last_verified_at: 2026-06-19
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

## Interfaces and dependencies

| Provides / consumes | Counterparty | Contract | Failure handling | Evidence | Status |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | — | unknown |

## SOPs and checklists

- Relevant Skills under `.agents/skills/` are candidate procedures.
- Project-specific commands and paths require verification before promotion.

## Risks, debt, and open questions

| ID | Risk/debt/question | Impact | Owner | Target/review | Status |
|---|---|---|---|---|---|
| PLAT-20260619-001 | Live Vercel/Supabase deployment state not verified | Release readiness unknown | Platform + Operations | before release | open |
| PLAT-20260619-002 | Sandbox build failure can be misread as code failure | Wasted debugging | Platform + QA | health-check runbook | open |

## Lessons and anti-patterns

- Do not infer project facts from the generic AI Company OS template.
- Promote repeated evidence, not stylistic preference, into durable standards.

## Capability and tool notes

| Agent/Skill | Current evidence | Capability | Permission | Limitation |
|---|---|---|---|---|
| TBD | none | C0/C1 | task-specific | not evaluated |

## Memory change log

| Date | Change | Source/task | Author/reviewer | Status |
|---|---|---|---|---|
| 2026-06-19 | Initial RepairDesk platform baseline synchronized | TASK-20260619-003 | Integration Lead | active |
