# Memory Delta — TASK-20260712-005-buyback-guided-evidence

## Candidate project facts

- Restricted buyback evidence uses a dedicated private bucket contract, short-lived on-demand access, access audit, staged/bound evidence states and nullable retention/legal-hold metadata. Source: task diff and E-002/E-003. Status: implemented locally, production migration not applied. Owner: RepairDesk. Review trigger: production migration planning.
- Guided buyback is a six-step mobile/desktop flow with Sales handoff and Owner/Manager evidence/finalize separation. Source: E-006/E-009. Status: verified. Owner: Product/FE. Review trigger: role or workflow change.

## Candidate department updates

- SEC/DATA: returned buybacks must reset IMEI, activation-lock and data-wipe checks; quality checks require version/CAS protection. Source: repository and mock regressions. Status: verified locally. Review trigger: inventory state-machine or quality-check persistence change.

## Candidate decisions / ADRs

- Full identity document numbers must never be persisted in inventory notes, legacy payload, logs or client persistence; store only last4/masked display plus restricted images. Status: accepted task decision. Owner: Owner/SEC. Review trigger: identity-provider or compliance redesign.
- Production migration and deployment are explicitly out of scope and remain NO-GO until linked-environment verification and legal/retention approval. Status: active release gate. Owner: Owner/REL/DATA/SEC.

## Candidate lessons and capability evidence

- For hosted Base64 evidence uploads, validate the complete raw-file to Base64 JSON envelope at client, schema, repository and route layers; a file-only limit is insufficient. Evidence: 2.4MB raw / 4.4MB route guards and route regression.
- Browser role tests must start the dev server with `REPAIRDESK_E2E_BUSINESS_DESKTOP=1`; setting it only on Playwright leaves the server actor fail-closed, which is expected security behavior rather than a UI locator bug.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.

## Consolidation result — 2026-07-13

- Promoted the verified buyback authorization, evidence, atomic-finalize and resale-check contracts to `PROJECT_MEMORY.md` and Backend/Data/Frontend/Security/QA department memory.
- Added the closed task to `MEMORY_INDEX.md`.
- Recorded a C2 candidate for read-only cross-layer buyback security review; permission and autonomy remain unchanged.
- Did not promote temporary test IDs, screenshot transaction numbers, failed stale-server runs or local process details.
- No new memory conflict was created: production migration drift remains covered by `CONFLICT-20260619-006` and is explicitly referenced as a release blocker.
