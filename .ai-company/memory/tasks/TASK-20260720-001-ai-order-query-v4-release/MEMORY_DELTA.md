# Memory Delta — TASK-20260720-001-ai-order-query-v4-release

## Candidate project facts

- **Fact:** Order Query V4 uses evidence-backed model candidates, local trusted precedence and provider-free signed/encrypted continuation. **Source:** E-008/E-013/E-017. **Status:** production verified at `321834c8`. **Owner:** RepairDesk Integration Lead. **Scope:** staff order assistant only. **Review trigger:** contract, provider, RBAC, repository or continuation-secret changes.
- **Fact:** The release evaluation corpus is `order-query-eval-v1` with 417 zh/it/en cases. **Source:** E-009/E-012. **Status:** release-gate verified. **Owner:** QA. **Scope:** order-query parsing and evidence compilation. **Review trigger:** new locale, ontology, date expression or prompt version.

## Candidate department updates

- None yet.

## Candidate decisions / ADRs

- **Decision:** keep public AI and inline writes off; allow the model to propose only closed-world constraints that quote the user exactly. **Source:** TASK.md and E-008. **Status:** accepted for V4. **Owner:** 鹤祥. **Scope:** first read-only release. **Review trigger:** any proposal to add write tools, PII search through the model, or broaden stores.
- **Decision:** reuse the existing request-fingerprint secret with domain-separated AES-GCM sealing plus HMAC signature for short-lived continuation; do not add a new production secret in this slice. **Source:** E-013. **Status:** implemented. **Owner:** Security/Integration. **Scope:** 10-minute order-query continuation only. **Review trigger:** secret rotation, token persistence or cross-device continuation.

## Candidate lessons and capability evidence

- **Lesson:** signed Base64 payloads protect integrity but not confidentiality; browser-carried query plans must be opaque before they can safely include local customer search terms. **Source:** pre-integration security review and E-013. **Status:** resolved before release. **Owner:** Security. **Scope:** all future browser tokens. **Review trigger:** any new signed client token.
- **Capability evidence:** AI-focused 136/136, browser 12/12 and bounded-worker full Vitest 2,088/2,088 pass; earlier broad parallel timeouts were cleared by isolated 5/5 and 20/20 reruns plus the final full pass. **Source:** E-009–E-012. **Status:** verified. **Owner:** QA. **Scope:** this release. **Review trigger:** CI disagreement or post-rebase code overlap.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
