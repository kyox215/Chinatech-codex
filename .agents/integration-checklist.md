# Multi-Agent Integration Checklist

Use this before final response whenever sub-agents, departments, or scoped workers were used.

## Before Spawning

- [ ] Read `AGENTS.md`.
- [ ] Read `AI智能部门管理/部门化管理设计.md`.
- [ ] Read `.agents/README.md`.
- [ ] Record agenda intake.
- [ ] Record `decision_owner: Integration Lead`.
- [ ] Generate route plan from `.agents/repairdesk-multiagent.yaml`.
- [ ] Decide why multi-agent is necessary.
- [ ] Identify the main thread's immediate local work.
- [ ] Assign only sidecar or disjoint worker tasks.
- [ ] Check file ownership does not overlap before spawning writers.
- [ ] Avoid duplicate questions.

## While Agents Run

- [ ] Continue useful non-overlapping main-thread work.
- [ ] Do not wait unless blocked.
- [ ] Do not duplicate delegated work.
- [ ] Keep file ownership disjoint.
- [ ] Close completed agents when no longer needed.
- [ ] Ensure sub-agents report blockers to Integration Lead instead of asking the user directly.

## Before Applying Agent Suggestions

- [ ] Check suggestions against user latest request.
- [ ] Check against `AGENTS.md`.
- [ ] Check against RepairOS and architecture docs.
- [ ] Reject suggestions that expand scope without need.
- [ ] Reject suggestions that weaken privacy, auth, data, or workflow rules.
- [ ] Record accepted and rejected suggestions in the run log when departments disagree.

## Verification Gates

Default:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

UI changes:

- [ ] Verify key mobile viewport.
- [ ] Check `document.documentElement.scrollWidth <= window.innerWidth`.
- [ ] Check dialog/sheet body scroll and bottom actions.
- [ ] Check keyboard input does not zoom mobile page.

Data/API changes:

- [ ] Server, client, mock, and type contracts match.
- [ ] React Query invalidation is correct.
- [ ] Database migrations are listed and applied intentionally.
- [ ] No client-only business enforcement for critical rules.

Security/PII changes:

- [ ] No secrets committed.
- [ ] No unnecessary PII in logs, public routes, QR payloads, or local storage.
- [ ] Store isolation and auth checks remain server-side.

## Final Report

Include:

- What changed.
- Key files.
- Agents/departments used.
- Sources used if web research was required.
- Validation run.
- Skipped validation and reason.
- Remaining risk.
