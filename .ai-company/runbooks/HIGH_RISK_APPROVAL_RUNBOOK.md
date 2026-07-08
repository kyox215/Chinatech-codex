# High-Risk Approval Runbook

## Trigger

Use for R3/R4 or D3/D4 decisions: production writes, destructive or difficult
migrations, authentication/authorization, restricted data, payments, pricing,
legal commitments, public/customer communication, substantial spend, or
irreversible external actions.

## Prepare an approval package

```markdown
# Decision requested
# Decision owner and deadline
# Recommended option
# Alternatives considered
# Business value
# Affected users/systems/data
# Security/privacy/legal/financial impact
# Failure modes and blast radius
# Validation evidence
# Rollback, recovery, and irreversibility
# Execution window and operator
# Monitoring and stop thresholds
```

## Approval rules

- Name the exact action; do not request blanket permission.
- Separate approval to implement from approval to deploy/send/delete/spend.
- Approval expires when scope, target, artifact, environment, risk, or evidence changes.
- Silence, tool access, or prior approval for another task is not approval.
- Emergency authority must have a defined incident role, time window, logging, and post-review.

## Execution

1. Confirm approver identity and scope.
2. Record approval in task evidence/decision record.
3. Re-check target environment and artifact digest.
4. Execute the smallest approved step.
5. Observe defined health signals.
6. Stop/rollback at thresholds; do not improvise beyond authority.
7. Record actual result and remaining risk.
