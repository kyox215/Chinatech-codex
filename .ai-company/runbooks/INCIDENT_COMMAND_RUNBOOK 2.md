# Incident Command Runbook

## Roles

- Incident Commander: owns priorities and decisions.
- Operations lead: executes mitigation/recovery.
- Investigation lead: gathers evidence and tests hypotheses.
- Communications lead: internal/customer/status updates.
- Scribe: factual timeline, commands/actions, results, and owners.

One person may hold multiple roles for small incidents, but command authority and
records remain explicit.

## First 15 minutes

1. Declare severity, affected service/users/data, and start time.
2. Establish communication channel and update cadence.
3. Protect people, data, and customer trust; isolate or degrade safely.
4. Freeze unrelated releases and preserve evidence.
5. Identify recent changes without assuming causation.
6. Define next decision time and current owner.

## Mitigation and recovery

- Prefer reversible containment: feature flag, traffic shift, rate limit, rollback,
  credential rotation, queue pause, or read-only mode.
- Validate every mitigation against health and data signals.
- Do not run destructive “cleanup” while data state is uncertain.
- For security/privacy events, involve authorized security/legal owners and follow
  notification obligations.

## Communications

State verified impact, what users should do, mitigation status, and next update.
Do not speculate about root cause or promise recovery times without evidence.

## Closure and learning

- Define stable-recovery criteria and observation window.
- Produce a blameless causal analysis with contributing factors.
- Turn actions into owned, testable tasks.
- Update runbooks, alerts, tests, architecture, memory, and capability records.
