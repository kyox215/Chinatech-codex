# Memory Delta — TASK-20260719-005-ai-search-accuracy-collapsible-ui

## Candidate project facts

- `verified` / Owner: Integration Lead / Scope: ChinaTech employee order-text assistant — original-message device intent is a server-owned constraint in both local and model modes; schema-valid provider output cannot broaden it. Source: `ARCHITECTURE_DECISION.md`, E-002..E-006. Review trigger: provider contract or query language change. Promoted to `PROJECT_MEMORY.md`.

## Candidate department updates

- `production_verified` Backend/Security/QA contract — reconcile trusted device constraints after the single provider plan, fail closed on incompatible result cards and preserve one-attempt settlement. Source: E-004..E-006, E-011..E-014. Promoted to backend/security/qa memory.
- `production_verified` Frontend contract — usage and processing disclosures remain independent, default collapsed, keyboard-accessible and truthful about model external sending/usage. Source: E-007..E-010. Promoted to frontend memory.

## Candidate decisions / ADRs

- No new organization-wide ADR. The bounded implementation decision remains task-scoped in `ARCHITECTURE_DECISION.md`; it does not authorize model, key, budget, allowlist, PII, Vision, write-tool or multi-store expansion.

## Candidate lessons and capability evidence

- `candidate C1` — one bounded semantic-remediation and no-migration production release succeeded with independent read-only review, full gates, responsive evidence and exact deployment. Added as `CAP-AI-SEMANTIC-GUARD-20260719`; no Permission or Autonomy upgrade. Review after the next AI accuracy incident or provider-contract change.
- Not promoted: the exact screenshot example, temporary worktree dependency symlink and individual command timing are task evidence, not durable operating rules.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
