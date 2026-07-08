# Agent and Skill Capability Evolution Runbook

## Principle

Agent behavior may improve through evidence, but the system must never confuse
knowledge, capability, permission, and autonomy.

## Evidence collection

For each relevant work package record:

- task/risk/domain complexity;
- instructions and tools available;
- correctness and completeness;
- independent QA/security findings;
- number and severity of revisions;
- scope/permission adherence;
- recovery from ambiguity or failure;
- reproducibility on a second task.

## Promotion process

1. Observation creates a capability candidate.
2. Capability Auditor checks generalizability and counterexamples.
3. Propose an Agent instruction or Skill change.
4. Test in sandbox with positive, boundary, adversarial, and refusal cases.
5. Obtain applicable QA/security review.
6. Approver sets bounded level, permission, autonomy, metrics, and expiry.
7. Roll out to a narrow task class.
8. Monitor and either stabilize, revise, downgrade, or revoke.

## Level guidance

- C1 requires basic role usefulness under close review.
- C2 requires repeated bounded execution with supervision.
- C3 requires reliable performance across representative cases and normal review.
- C4 requires deterministic boundaries, rollback, monitoring, audit, and explicit
  permission; it is inappropriate for broad open-ended authority.

## Downgrade triggers

Material correctness failures, permission overreach, repeated unsupported claims,
security incidents, tool/model changes, stale expertise, or failed evaluation.

## Required records

Update `CAPABILITY_REGISTRY.md`, Agent memory, Skill version/change proposal, test
evidence, approver, effective scope, next review, and revoke condition.
