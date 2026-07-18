# Department Agent Packages

The Owner Simple Mode requirement was satisfied with three real, read-only department agents. The main thread remains the sole writer and Integration Lead.

| Agent | Departments | Permission | Independent deliverable |
|---|---|---|---|
| `phase3b_arch_api` | INT / API / Architecture | read-only | provider/factory/service integration review and minimal architecture proposal |
| `phase3b_security_data` | SEC / DATA | read-only | secret, PII, RLS/RPC, idempotency, reservation/finalization threat review |
| `phase3b_qa_release` | QA / Release / DOC | read-only | test matrix, live-smoke boundary, release/rollback and documentation review |

Common prohibitions: no `.env*` access, no secret/API handling, no real provider calls, no DB mutation, no staging/commit/push/deploy, and no user-facing permission request.
