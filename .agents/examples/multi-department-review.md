# Example: Multi-Department Review

Use this when a task changes workflow, data, UI, and security surfaces.

```txt
run_id: buyback-flow-hardening-001
decision_owner: Integration Lead
user_goal: Make buyback quote flow production-ready for iPhone intake.

departments:
  - department: FLOW
    mode: read_only
    goal: Define allowed buyback stages, blocking risks, and role actions.
  - department: DATA
    mode: read_only
    goal: Audit quote draft, inventory, attachment, and pricing contracts.
  - department: UX
    mode: read_only
    goal: Review RepairOS mobile step-by-step layout and tap target density.
  - department: SEC
    mode: read_only
    goal: Review PII, ID photos, signatures, storage privacy, and proof requirements.
  - department: QA
    mode: read_only
    goal: Simulate front desk, owner, and customer acceptance paths.

debate:
  proposal_required_fields:
    - department
    - problem_statement
    - proposal
    - evidence
    - risks
    - verification_plan
  objection_required_fields:
    - raised_by
    - target_proposal
    - claim
    - evidence
    - severity
    - suggested_resolution

completion:
  - Integration Lead accepts, rejects, or defers each finding.
  - Integration Lead performs final integration.
  - Verification results and skipped checks are reported.
```
